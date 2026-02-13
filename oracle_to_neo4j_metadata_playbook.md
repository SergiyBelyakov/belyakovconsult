# Oracle Data Dictionary CSV → Neo4j: уніфікований граф метаданих (playbook)

## 0) Ціль і межі

Мета: побудувати **повторно-використовуваний стандарт** графа метаданих Oracle БД у Neo4j з CSV-екстрактів типів:

- `L0.1.TABLES.csv`
- `L0.2.COLUMNS.csv`
- `L0.3.CONSTRAINTS.csv`
- `L0.4.CONSTRAINTS_COLUMNS.csv`
- `L0.5.FK_EDGES.csv`
- `L0.6.1.INDEXES.csv`
- `L0.6.2.COLUMNS_INDEXES.csv`
- `L0.7.SYNONYMS.csv`
- `L0.8.1.COMMENTS.csv`
- `L1.8.OBJECTS.csv`
- `L1.9.DEPENDS_ON.csv`
- `L1.10.VIEW.csv`
- `L1.11.PL_SQL_SOURCE.csv`
- `L1.13.METADATA.csv`

Принцип: ідемо крок за кроком. Не переходимо далі, поки крок не пройшов QC.

---

## 1) Стандарт цільової графової моделі

### 1.1 Лейбли вузлів

- `:Database` — логічне джерело/інстанс Oracle (зафіксований контекст імпорту).
- `:Schema` — Oracle owner/schema.
- `:Table` — таблиці.
- `:Column` — колонки таблиць.
- `:Constraint` — PK/UK/FK/Check/ін.
- `:Index` — індекси.
- `:Synonym` — синоніми.
- `:DbObject` — загальні об’єкти (PACKAGE, PROCEDURE, FUNCTION, TRIGGER, MATERIALIZED VIEW тощо).
- `:View` — view (окремий лейбл для фокусної аналітики).
- `:PLSQLUnit` — одиниця коду (агрегована по object/subprogram/version).
- `:ImportRun` — технічний вузол для трасування запуску імпорту.

> Примітка: `:View` може мати також `:DbObject` як додатковий лейбл.

### 1.2 Типи зв’язків

- `(:Database)-[:HAS_SCHEMA]->(:Schema)`
- `(:Schema)-[:OWNS_TABLE]->(:Table)`
- `(:Table)-[:HAS_COLUMN]->(:Column)`
- `(:Table)-[:HAS_CONSTRAINT]->(:Constraint)`
- `(:Constraint)-[:CONSTRAINT_ON_COLUMN {position}]->(:Column)`
- `(:Constraint {type:'R'})-[:FK_REFERENCES]->(:Constraint)` (FK → PK/UK)
- `(:Constraint)-[:FK_SOURCE_TABLE]->(:Table)`
- `(:Constraint)-[:FK_TARGET_TABLE]->(:Table)`
- `(:Table)-[:HAS_INDEX]->(:Index)`
- `(:Index)-[:INDEX_ON_COLUMN {position, descend}]->(:Column)`
- `(:Schema)-[:OWNS_SYNONYM]->(:Synonym)`
- `(:Synonym)-[:SYNONYM_OF {db_link}]->(:Table|:View|:DbObject)`
- `(:Schema)-[:OWNS_OBJECT]->(:DbObject)`
- `(:Schema)-[:OWNS_VIEW]->(:View)`
- `(:DbObject)-[:DEPENDS_ON]->(:DbObject|:Table|:View|:Synonym)`
- `(:View)-[:DEPENDS_ON]->(:DbObject|:Table|:View|:Synonym)`
- `(:Table)-[:HAS_COMMENT]->(:DbObject {kind:'COMMENT'})` (опційно)
- `(:Column)-[:HAS_COMMENT]->(:DbObject {kind:'COMMENT'})` (опційно)
- `(:ImportRun)-[:LOADED]->(:Database)`

### 1.3 Обов’язкові властивості (мінімум)

- Спільні: `id`, `db`, `schema`, `name`, `source_file`, `imported_at`.
- `Table`: `tablespace`, `temporary`, `iot_type`, `num_rows`, `partitioned`.
- `Column`: `data_type`, `data_length`, `data_precision`, `data_scale`, `nullable`, `column_id`, `default_expr`.
- `Constraint`: `constraint_type`, `status`, `validated`, `deferrable`, `deferred`, `generated`, `search_condition`.
- `Index`: `index_type`, `uniqueness`, `status`, `visibility`, `partitioned`.
- `Synonym`: `target_owner`, `target_name`, `target_type`, `db_link`.
- `DbObject/View`: `object_type`, `status`, `created`, `last_ddl_time`.
- `PLSQLUnit`: `line_count`, `hash`, `source_text` (якщо дозволено зберігати повний код).

---

## 2) Уніфікована схема `id` (для стабільного MERGE без дублів)

Використовуємо **канонічний ключ**:

- все у `UPPER(TRIM(...))`
- `NULL` → порожній рядок
- префікс з типом вузла
- обов’язково включаємо `db` (щоб уникати колізій між БД)

### 2.1 Шаблони id

- `Database.id = "DB|<DB_NAME>"`
- `Schema.id = "SCH|<DB>|<SCHEMA>"`
- `Table.id = "TAB|<DB>|<SCHEMA>|<TABLE>"`
- `Column.id = "COL|<DB>|<SCHEMA>|<TABLE>|<COLUMN>"`
- `Constraint.id = "CNS|<DB>|<OWNER>|<CONSTRAINT_NAME>"`
- `Index.id = "IDX|<DB>|<OWNER>|<INDEX_NAME>"`
- `Synonym.id = "SYN|<DB>|<OWNER>|<SYNONYM_NAME>"`
- `DbObject.id = "OBJ|<DB>|<OWNER>|<OBJECT_TYPE>|<OBJECT_NAME>"`
- `View.id = "VIEW|<DB>|<OWNER>|<VIEW_NAME>"`
- `PLSQLUnit.id = "PLS|<DB>|<OWNER>|<OBJECT_TYPE>|<OBJECT_NAME>|<SUBPROGRAM>"`

### 2.2 Чому саме так

- Стабільність: id не залежить від порядку імпорту.
- Ідемпотентність: повторний запуск дає `MERGE` без дублів.
- Діагностика: по id видно джерело конфлікту.
- Масштабування: можна зливати кілька БД в один граф.

---

## 3) DDL для Neo4j: constraints + indexes

> Для Neo4j 5.x. Запускати **до** імпорту даних.

```cypher
// ---------- Унікальність ----------
CREATE CONSTRAINT db_id_unique IF NOT EXISTS
FOR (n:Database) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT schema_id_unique IF NOT EXISTS
FOR (n:Schema) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT table_id_unique IF NOT EXISTS
FOR (n:Table) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT column_id_unique IF NOT EXISTS
FOR (n:Column) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT constraint_id_unique IF NOT EXISTS
FOR (n:Constraint) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT index_id_unique IF NOT EXISTS
FOR (n:Index) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT synonym_id_unique IF NOT EXISTS
FOR (n:Synonym) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT object_id_unique IF NOT EXISTS
FOR (n:DbObject) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT view_id_unique IF NOT EXISTS
FOR (n:View) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT plsql_id_unique IF NOT EXISTS
FOR (n:PLSQLUnit) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT importrun_id_unique IF NOT EXISTS
FOR (n:ImportRun) REQUIRE n.id IS UNIQUE;

// ---------- Індекси для фільтрації/джоїнів ----------
CREATE INDEX table_schema_name_idx IF NOT EXISTS
FOR (n:Table) ON (n.db, n.schema, n.name);

CREATE INDEX column_schema_table_name_idx IF NOT EXISTS
FOR (n:Column) ON (n.db, n.schema, n.table, n.name);

CREATE INDEX constraint_owner_name_idx IF NOT EXISTS
FOR (n:Constraint) ON (n.db, n.owner, n.name);

CREATE INDEX constraint_type_idx IF NOT EXISTS
FOR (n:Constraint) ON (n.constraint_type);

CREATE INDEX index_owner_name_idx IF NOT EXISTS
FOR (n:Index) ON (n.db, n.owner, n.name);

CREATE INDEX object_owner_type_name_idx IF NOT EXISTS
FOR (n:DbObject) ON (n.db, n.owner, n.object_type, n.name);

CREATE INDEX synonym_target_idx IF NOT EXISTS
FOR (n:Synonym) ON (n.target_owner, n.target_name, n.db_link);
```

Перевірка:

```cypher
SHOW CONSTRAINTS;
SHOW INDEXES;
```

Критерій успіху: всі expected constraints/indexes існують, `state='ONLINE'`.

---

## 4) Resilient-імпорт: підготовка, діагностика, нормалізація

### 4.1 Канонізація рядків у Cypher

У кожному `LOAD CSV`:

```cypher
WITH row,
     toUpper(trim(coalesce(row.OWNER, row.SCHEMA, ''))) AS owner,
     toUpper(trim(coalesce(row.TABLE_NAME, ''))) AS table_name,
     toUpper(trim(coalesce(row.COLUMN_NAME, ''))) AS column_name
```

### 4.2 Порожні/биті значення

- Перед `MERGE` завжди `WHERE key <> ''`.
- Для numeric/date: `CASE WHEN trim(x)='' THEN NULL ELSE toInteger(x) END`.
- Для boolean-подібних прапорців: зберігати як text (`Y/N`), не насильно кастити.

### 4.3 Якщо CSV з `;` або `,`

1) Діагностика:

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.1.TABLES.csv' AS row
RETURN keys(row) AS headers, row LIMIT 1;
```

2) Якщо бачите один “злиплий” header — неправильний delimiter.

3) Повторити з `FIELDTERMINATOR ';'` або без нього.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.1.TABLES.csv' AS row FIELDTERMINATOR ';'
RETURN keys(row), row LIMIT 1;
```

### 4.4 BOM/пробіли/відсутні колонки

- BOM у header: звертатися через `coalesce(row."\uFEFFOWNER", row.OWNER)`.
- Пробіли у назвах: `row["TABLE_NAME "]` + `trim`.
- Відсутня колонка: завжди `coalesce(row.COL_X, '')`.

### 4.5 Часті помилки і дії

- `Cannot merge ... null property` → ключ порожній. Додати `WHERE key<>''`.
- `ExternalResourceFailed` → перевірити `dbms.directories.import`, шлях `file:///`, ім’я файлу, права.
- `22N31 invalid properties` → не передавати map з null-ключами/unsupported типами; ставити явні scalar fields.
- `No changes, no records` → файл порожній / не той delimiter / всі рядки відфільтровані `WHERE`.

---

## 5) Pipeline імпорту (послідовність + QC)

> У прикладах параметр:

```cypher
:param DB_NAME => 'ORCL_UNKNOWN';
:param RUN_ID => 'RUN_' + toString(timestamp());
```

### Крок 1. Створити контекст імпорту (Database, ImportRun)

**Для чого:** мати контрольований простір id.

```cypher
MERGE (d:Database {id:'DB|' + toUpper(trim($DB_NAME))})
  ON CREATE SET d.name=toUpper(trim($DB_NAME)), d.created_at=datetime()
SET d.last_seen_at=datetime();

MERGE (r:ImportRun {id:$RUN_ID})
  ON CREATE SET r.started_at=datetime()
WITH r
MATCH (d:Database {id:'DB|' + toUpper(trim($DB_NAME))})
MERGE (r)-[:LOADED]->(d);
```

QC:

```cypher
MATCH (d:Database {id:'DB|' + toUpper(trim($DB_NAME))}) RETURN count(d) AS c;
MATCH (r:ImportRun {id:$RUN_ID})-[:LOADED]->(d:Database) RETURN count(*) AS c;
```

Критерій успіху: `c=1` в обох перевірках.

---

### Крок 2. Імпорт Schema (з усіх релевантних CSV)

**Для чого:** всі інші вузли прив’язуються до schema.

```cypher
// Приклад з TABLES; за потреби повторити з OBJECTS/SYNONYMS для дозбору owner
LOAD CSV WITH HEADERS FROM 'file:///L0.1.TABLES.csv' AS row
WITH toUpper(trim(coalesce(row.OWNER, row.SCHEMA, row.TABLE_OWNER, ''))) AS owner
WHERE owner <> ''
MERGE (s:Schema {id:'SCH|' + toUpper(trim($DB_NAME)) + '|' + owner})
  ON CREATE SET s.db=toUpper(trim($DB_NAME)), s.name=owner, s.created_at=datetime();
```

Зв’язок з Database:

```cypher
MATCH (d:Database {id:'DB|' + toUpper(trim($DB_NAME))}), (s:Schema)
WHERE s.db = toUpper(trim($DB_NAME))
MERGE (d)-[:HAS_SCHEMA]->(s);
```

QC:

```cypher
MATCH (s:Schema {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS schemas;
MATCH (d:Database {id:'DB|' + toUpper(trim($DB_NAME))})-[:HAS_SCHEMA]->(s:Schema) RETURN count(*) AS links;
```

Критерій: `schemas > 0`, `links = schemas`.

---

### Крок 3. TABLES → Table + Schema-ownership

**Для чого:** базовий рівень структури.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.1.TABLES.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER, row.SCHEMA, ''))) AS owner,
     toUpper(trim(coalesce(row.TABLE_NAME, ''))) AS table_name
WHERE owner<>'' AND table_name<>''
MERGE (t:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + table_name})
  ON CREATE SET t.db=toUpper(trim($DB_NAME)), t.schema=owner, t.name=table_name, t.created_at=datetime()
SET t.tablespace = trim(coalesce(row.TABLESPACE_NAME,'')),
    t.temporary = trim(coalesce(row.TEMPORARY,'')),
    t.iot_type = trim(coalesce(row.IOT_TYPE,'')),
    t.partitioned = trim(coalesce(row.PARTITIONED,'')),
    t.num_rows = CASE WHEN trim(coalesce(row.NUM_ROWS,''))='' THEN NULL ELSE toInteger(row.NUM_ROWS) END,
    t.source_file='L0.1.TABLES.csv',
    t.imported_at=datetime();

MATCH (s:Schema {id:'SCH|' + toUpper(trim($DB_NAME)) + '|' + t.schema})
MERGE (s)-[:OWNS_TABLE]->(t);
```

QC:

```cypher
MATCH (t:Table {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS tables;
MATCH (t:Table {db:toUpper(trim($DB_NAME))}) WHERE t.name='' OR t.schema='' RETURN count(*) AS bad_keys;
MATCH (s:Schema)-[:OWNS_TABLE]->(t:Table {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS rels;
```

Критерій: `tables>0`, `bad_keys=0`, `rels=tables`.

---

### Крок 4. COLUMNS → Column + Table↔Column

**Для чого:** деталізація структури таблиць.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.2.COLUMNS.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER, row.SCHEMA, ''))) AS owner,
     toUpper(trim(coalesce(row.TABLE_NAME, ''))) AS table_name,
     toUpper(trim(coalesce(row.COLUMN_NAME, ''))) AS column_name
WHERE owner<>'' AND table_name<>'' AND column_name<>''
MERGE (c:Column {id:'COL|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + table_name + '|' + column_name})
  ON CREATE SET c.db=toUpper(trim($DB_NAME)), c.schema=owner, c.table=table_name, c.name=column_name, c.created_at=datetime()
SET c.column_id = CASE WHEN trim(coalesce(row.COLUMN_ID,''))='' THEN NULL ELSE toInteger(row.COLUMN_ID) END,
    c.data_type = trim(coalesce(row.DATA_TYPE,'')),
    c.data_length = CASE WHEN trim(coalesce(row.DATA_LENGTH,''))='' THEN NULL ELSE toInteger(row.DATA_LENGTH) END,
    c.data_precision = CASE WHEN trim(coalesce(row.DATA_PRECISION,''))='' THEN NULL ELSE toInteger(row.DATA_PRECISION) END,
    c.data_scale = CASE WHEN trim(coalesce(row.DATA_SCALE,''))='' THEN NULL ELSE toInteger(row.DATA_SCALE) END,
    c.nullable = trim(coalesce(row.NULLABLE,'')),
    c.default_expr = trim(coalesce(row.DATA_DEFAULT,'')),
    c.source_file='L0.2.COLUMNS.csv',
    c.imported_at=datetime();

MATCH (t:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|' + c.schema + '|' + c.table})
MERGE (t)-[:HAS_COLUMN]->(c);
```

QC:

```cypher
MATCH (c:Column {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS columns;
MATCH (c:Column {db:toUpper(trim($DB_NAME))}) WHERE c.data_type='' RETURN count(*) AS no_type;
MATCH (t:Table {db:toUpper(trim($DB_NAME))}) WHERE NOT (t)-[:HAS_COLUMN]->() RETURN count(*) AS tables_without_columns;
```

Критерій: `columns>0`; `tables_without_columns` очікувано малий/пояснений.

---

### Крок 5. CONSTRAINTS → Constraint + Table↔Constraint

**Для чого:** ключі, правила цілісності.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.3.CONSTRAINTS.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER, row.CONSTRAINT_OWNER, ''))) AS owner,
     toUpper(trim(coalesce(row.CONSTRAINT_NAME, ''))) AS c_name,
     toUpper(trim(coalesce(row.TABLE_NAME, ''))) AS table_name
WHERE owner<>'' AND c_name<>''
MERGE (cns:Constraint {id:'CNS|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + c_name})
  ON CREATE SET cns.db=toUpper(trim($DB_NAME)), cns.owner=owner, cns.name=c_name, cns.created_at=datetime()
SET cns.table = table_name,
    cns.constraint_type = trim(coalesce(row.CONSTRAINT_TYPE,'')),
    cns.status = trim(coalesce(row.STATUS,'')),
    cns.validated = trim(coalesce(row.VALIDATED,'')),
    cns.deferrable = trim(coalesce(row.DEFERRABLE,'')),
    cns.deferred = trim(coalesce(row.DEFERRED,'')),
    cns.generated = trim(coalesce(row.GENERATED,'')),
    cns.search_condition = trim(coalesce(row.SEARCH_CONDITION,'')),
    cns.r_owner = toUpper(trim(coalesce(row.R_OWNER,''))),
    cns.r_constraint_name = toUpper(trim(coalesce(row.R_CONSTRAINT_NAME,''))),
    cns.source_file='L0.3.CONSTRAINTS.csv',
    cns.imported_at=datetime();

WITH cns
WHERE cns.table <> ''
MATCH (t:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|' + cns.owner + '|' + cns.table})
MERGE (t)-[:HAS_CONSTRAINT]->(cns);
```

QC:

```cypher
MATCH (c:Constraint {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS constraints;
MATCH (c:Constraint {db:toUpper(trim($DB_NAME))}) WHERE c.constraint_type IN ['P','U','R','C'] RETURN c.constraint_type, count(*) AS cnt;
MATCH (c:Constraint {db:toUpper(trim($DB_NAME))}) WHERE NOT ()-[:HAS_CONSTRAINT]->(c) RETURN count(*) AS orphan_constraints;
```

Критерій: `constraints>0`; orphan мінімум або пояснений.

---

### Крок 6. CONSTRAINTS_COLUMNS → Constraint↔Column (position)

**Для чого:** відновити склад PK/UK/FK/check по колонках.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.4.CONSTRAINTS_COLUMNS.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER, row.CONSTRAINT_OWNER, ''))) AS owner,
     toUpper(trim(coalesce(row.CONSTRAINT_NAME, ''))) AS c_name,
     toUpper(trim(coalesce(row.TABLE_NAME, ''))) AS table_name,
     toUpper(trim(coalesce(row.COLUMN_NAME, ''))) AS column_name,
     CASE WHEN trim(coalesce(row.POSITION,''))='' THEN NULL ELSE toInteger(row.POSITION) END AS pos
WHERE owner<>'' AND c_name<>'' AND table_name<>'' AND column_name<>''
MATCH (cns:Constraint {id:'CNS|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + c_name})
MATCH (col:Column {id:'COL|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + table_name + '|' + column_name})
MERGE (cns)-[r:CONSTRAINT_ON_COLUMN]->(col)
SET r.position = pos;
```

QC:

```cypher
MATCH (:Constraint {db:toUpper(trim($DB_NAME))})-[r:CONSTRAINT_ON_COLUMN]->(:Column {db:toUpper(trim($DB_NAME))})
RETURN count(*) AS links, min(r.position) AS min_pos, max(r.position) AS max_pos;
```

Критерій: `links>0`, `min_pos>=1` (або NULL тільки якщо у джерелі немає POSITION).

---

### Крок 7. FK_EDGES + CONSTRAINTS refs → FK ланцюг

**Для чого:** напрямлені залежності даних між таблицями.

Варіант A (кращий): з `L0.5.FK_EDGES.csv`.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.5.FK_EDGES.csv' AS row
WITH row,
 toUpper(trim(coalesce(row.FK_OWNER,''))) AS fk_owner,
 toUpper(trim(coalesce(row.FK_NAME, row.FK_CONSTRAINT_NAME,''))) AS fk_name,
 toUpper(trim(coalesce(row.PK_OWNER, row.R_OWNER,''))) AS pk_owner,
 toUpper(trim(coalesce(row.PK_NAME, row.R_CONSTRAINT_NAME,''))) AS pk_name
WHERE fk_owner<>'' AND fk_name<>'' AND pk_owner<>'' AND pk_name<>''
MATCH (fk:Constraint {id:'CNS|' + toUpper(trim($DB_NAME)) + '|' + fk_owner + '|' + fk_name})
MATCH (pk:Constraint {id:'CNS|' + toUpper(trim($DB_NAME)) + '|' + pk_owner + '|' + pk_name})
MERGE (fk)-[:FK_REFERENCES]->(pk);
```

Варіант B (fallback): з полів `R_OWNER/R_CONSTRAINT_NAME` у `:Constraint`.

```cypher
MATCH (fk:Constraint {db:toUpper(trim($DB_NAME)), constraint_type:'R'})
WHERE fk.r_owner<>'' AND fk.r_constraint_name<>''
MATCH (pk:Constraint {id:'CNS|' + toUpper(trim($DB_NAME)) + '|' + fk.r_owner + '|' + fk.r_constraint_name})
MERGE (fk)-[:FK_REFERENCES]->(pk);
```

Прив’язка FK до source/target таблиць:

```cypher
MATCH (src_t:Table)-[:HAS_CONSTRAINT]->(fk:Constraint {db:toUpper(trim($DB_NAME)), constraint_type:'R'})-[:FK_REFERENCES]->(pk:Constraint)
MATCH (dst_t:Table)-[:HAS_CONSTRAINT]->(pk)
MERGE (fk)-[:FK_SOURCE_TABLE]->(src_t)
MERGE (fk)-[:FK_TARGET_TABLE]->(dst_t);
```

QC:

```cypher
MATCH (:Constraint {db:toUpper(trim($DB_NAME)), constraint_type:'R'})-[:FK_REFERENCES]->(:Constraint) RETURN count(*) AS fk_links;
MATCH (fk:Constraint {db:toUpper(trim($DB_NAME)), constraint_type:'R'})
WHERE NOT (fk)-[:FK_SOURCE_TABLE]->() OR NOT (fk)-[:FK_TARGET_TABLE]->()
RETURN count(*) AS fk_incomplete;
```

Критерій: `fk_links>0`; `fk_incomplete` мінімум.

---

### Крок 8. INDEXES + COLUMNS_INDEXES

**Для чого:** продуктивність/доступи, альтернативні зв’язки колонок.

```cypher
// INDEXES
LOAD CSV WITH HEADERS FROM 'file:///L0.6.1.INDEXES.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER, ''))) AS owner,
     toUpper(trim(coalesce(row.INDEX_NAME, ''))) AS idx_name,
     toUpper(trim(coalesce(row.TABLE_NAME, ''))) AS table_name
WHERE owner<>'' AND idx_name<>''
MERGE (i:Index {id:'IDX|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + idx_name})
  ON CREATE SET i.db=toUpper(trim($DB_NAME)), i.owner=owner, i.name=idx_name, i.created_at=datetime()
SET i.table = table_name,
    i.index_type = trim(coalesce(row.INDEX_TYPE,'')),
    i.uniqueness = trim(coalesce(row.UNIQUENESS,'')),
    i.status = trim(coalesce(row.STATUS,'')),
    i.visibility = trim(coalesce(row.VISIBILITY,'')),
    i.partitioned = trim(coalesce(row.PARTITIONED,'')),
    i.source_file='L0.6.1.INDEXES.csv',
    i.imported_at=datetime();

WITH i WHERE i.table<>''
MATCH (t:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|' + i.owner + '|' + i.table})
MERGE (t)-[:HAS_INDEX]->(i);

// INDEX COLUMNS
LOAD CSV WITH HEADERS FROM 'file:///L0.6.2.COLUMNS_INDEXES.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.TABLE_OWNER, row.OWNER, ''))) AS owner,
     toUpper(trim(coalesce(row.TABLE_NAME, ''))) AS table_name,
     toUpper(trim(coalesce(row.INDEX_NAME, ''))) AS idx_name,
     toUpper(trim(coalesce(row.COLUMN_NAME, ''))) AS column_name,
     CASE WHEN trim(coalesce(row.COLUMN_POSITION, row.POSITION,''))='' THEN NULL ELSE toInteger(coalesce(row.COLUMN_POSITION,row.POSITION)) END AS pos,
     trim(coalesce(row.DESCEND,'')) AS descend
WHERE owner<>'' AND table_name<>'' AND idx_name<>'' AND column_name<>''
MATCH (i:Index {id:'IDX|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + idx_name})
MATCH (c:Column {id:'COL|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + table_name + '|' + column_name})
MERGE (i)-[r:INDEX_ON_COLUMN]->(c)
SET r.position=pos, r.descend=descend;
```

QC:

```cypher
MATCH (t:Table {db:toUpper(trim($DB_NAME))})-[:HAS_INDEX]->(i:Index {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS table_index_links;
MATCH (:Index {db:toUpper(trim($DB_NAME))})-[r:INDEX_ON_COLUMN]->(:Column {db:toUpper(trim($DB_NAME))})
RETURN count(*) AS idx_col_links, min(r.position) AS min_pos, max(r.position) AS max_pos;
```

Критерій: обидва `count>0` (за наявності індексів у джерелі).

---

### Крок 9. SYNONYMS → target (+ dblink)

**Для чого:** розкрити непрямі залежності (в т.ч. між схемами/БД).

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.7.SYNONYMS.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER,''))) AS owner,
     toUpper(trim(coalesce(row.SYNONYM_NAME,''))) AS syn_name,
     toUpper(trim(coalesce(row.TABLE_OWNER,row.TARGET_OWNER,''))) AS trg_owner,
     toUpper(trim(coalesce(row.TABLE_NAME,row.TARGET_NAME,''))) AS trg_name,
     trim(coalesce(row.DB_LINK,'')) AS db_link
WHERE owner<>'' AND syn_name<>''
MERGE (s:Synonym {id:'SYN|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + syn_name})
  ON CREATE SET s.db=toUpper(trim($DB_NAME)), s.owner=owner, s.name=syn_name, s.created_at=datetime()
SET s.target_owner=trg_owner,
    s.target_name=trg_name,
    s.db_link=db_link,
    s.source_file='L0.7.SYNONYMS.csv',
    s.imported_at=datetime();

MATCH (sch:Schema {id:'SCH|' + toUpper(trim($DB_NAME)) + '|' + owner})
MERGE (sch)-[:OWNS_SYNONYM]->(s);

// Спроба резолву target як Table
WITH s
MATCH (t:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|' + s.target_owner + '|' + s.target_name})
MERGE (s)-[:SYNONYM_OF {db_link:s.db_link}]->(t);
```

Дорезолвити target як View/DbObject:

```cypher
MATCH (s:Synonym {db:toUpper(trim($DB_NAME))})
WHERE NOT (s)-[:SYNONYM_OF]->() AND s.target_owner<>'' AND s.target_name<>''
OPTIONAL MATCH (v:View {id:'VIEW|' + toUpper(trim($DB_NAME)) + '|' + s.target_owner + '|' + s.target_name})
OPTIONAL MATCH (o:DbObject {db:toUpper(trim($DB_NAME)), owner:s.target_owner, name:s.target_name})
FOREACH (_ IN CASE WHEN v IS NOT NULL THEN [1] ELSE [] END |
  MERGE (s)-[:SYNONYM_OF {db_link:s.db_link}]->(v)
)
FOREACH (_ IN CASE WHEN v IS NULL AND o IS NOT NULL THEN [1] ELSE [] END |
  MERGE (s)-[:SYNONYM_OF {db_link:s.db_link}]->(o)
);
```

QC:

```cypher
MATCH (s:Synonym {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS synonyms;
MATCH (s:Synonym {db:toUpper(trim($DB_NAME))}) WHERE NOT (s)-[:SYNONYM_OF]->() RETURN count(*) AS unresolved;
```

Критерій: `synonyms>0`; `unresolved` пояснений (часто через remote db_link).

---

### Крок 10. OBJECTS + VIEW + PL/SQL SOURCE + DEPENDS_ON

**Для чого:** граф логічних/процедурних залежностей.

```cypher
// OBJECTS
LOAD CSV WITH HEADERS FROM 'file:///L1.8.OBJECTS.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER,''))) AS owner,
     toUpper(trim(coalesce(row.OBJECT_NAME,''))) AS obj_name,
     toUpper(trim(coalesce(row.OBJECT_TYPE,''))) AS obj_type
WHERE owner<>'' AND obj_name<>'' AND obj_type<>''
MERGE (o:DbObject {id:'OBJ|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + obj_type + '|' + obj_name})
  ON CREATE SET o.db=toUpper(trim($DB_NAME)), o.owner=owner, o.name=obj_name, o.object_type=obj_type, o.created_at=datetime()
SET o.status = trim(coalesce(row.STATUS,'')),
    o.created = trim(coalesce(row.CREATED,'')),
    o.last_ddl_time = trim(coalesce(row.LAST_DDL_TIME,'')),
    o.source_file='L1.8.OBJECTS.csv',
    o.imported_at=datetime();

MATCH (s:Schema {id:'SCH|' + toUpper(trim($DB_NAME)) + '|' + owner})
MERGE (s)-[:OWNS_OBJECT]->(o);

// VIEW
LOAD CSV WITH HEADERS FROM 'file:///L1.10.VIEW.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER,''))) AS owner,
     toUpper(trim(coalesce(row.VIEW_NAME, row.OBJECT_NAME,''))) AS view_name
WHERE owner<>'' AND view_name<>''
MERGE (v:View {id:'VIEW|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + view_name})
  ON CREATE SET v.db=toUpper(trim($DB_NAME)), v.owner=owner, v.name=view_name, v.created_at=datetime()
SET v.text = coalesce(row.TEXT, row.TEXT_VC, ''),
    v.source_file='L1.10.VIEW.csv',
    v.imported_at=datetime();

MATCH (s:Schema {id:'SCH|' + toUpper(trim($DB_NAME)) + '|' + owner})
MERGE (s)-[:OWNS_VIEW]->(v);

// PLSQL SOURCE (агреговано)
LOAD CSV WITH HEADERS FROM 'file:///L1.11.PL_SQL_SOURCE.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER,''))) AS owner,
     toUpper(trim(coalesce(row.NAME, row.OBJECT_NAME,''))) AS obj_name,
     toUpper(trim(coalesce(row.TYPE, row.OBJECT_TYPE,''))) AS obj_type,
     trim(coalesce(row.TEXT,'')) AS txt,
     CASE WHEN trim(coalesce(row.LINE,''))='' THEN NULL ELSE toInteger(row.LINE) END AS line_no
WHERE owner<>'' AND obj_name<>'' AND obj_type<>''
WITH owner, obj_name, obj_type,
     collect({line:line_no, txt:txt}) AS lines
MERGE (p:PLSQLUnit {id:'PLS|' + toUpper(trim($DB_NAME)) + '|' + owner + '|' + obj_type + '|' + obj_name + '|MAIN'})
  ON CREATE SET p.db=toUpper(trim($DB_NAME)), p.owner=owner, p.object_type=obj_type, p.name=obj_name, p.created_at=datetime()
SET p.line_count = size(lines),
    p.source_file='L1.11.PL_SQL_SOURCE.csv',
    p.imported_at=datetime();

// DEPENDS_ON
LOAD CSV WITH HEADERS FROM 'file:///L1.9.DEPENDS_ON.csv' AS row
WITH row,
  toUpper(trim(coalesce(row.OWNER,''))) AS src_owner,
  toUpper(trim(coalesce(row.NAME,row.OBJECT_NAME,''))) AS src_name,
  toUpper(trim(coalesce(row.TYPE,row.OBJECT_TYPE,''))) AS src_type,
  toUpper(trim(coalesce(row.REFERENCED_OWNER,row.REF_OWNER,''))) AS ref_owner,
  toUpper(trim(coalesce(row.REFERENCED_NAME,row.REF_NAME,''))) AS ref_name,
  toUpper(trim(coalesce(row.REFERENCED_TYPE,row.REF_TYPE,''))) AS ref_type
WHERE src_owner<>'' AND src_name<>'' AND src_type<>'' AND ref_owner<>'' AND ref_name<>''
MATCH (src:DbObject {id:'OBJ|' + toUpper(trim($DB_NAME)) + '|' + src_owner + '|' + src_type + '|' + src_name})
OPTIONAL MATCH (refObj:DbObject {id:'OBJ|' + toUpper(trim($DB_NAME)) + '|' + ref_owner + '|' + ref_type + '|' + ref_name})
OPTIONAL MATCH (refTab:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|' + ref_owner + '|' + ref_name})
OPTIONAL MATCH (refView:View {id:'VIEW|' + toUpper(trim($DB_NAME)) + '|' + ref_owner + '|' + ref_name})
OPTIONAL MATCH (refSyn:Synonym {id:'SYN|' + toUpper(trim($DB_NAME)) + '|' + ref_owner + '|' + ref_name})
FOREACH (_ IN CASE WHEN refObj IS NOT NULL THEN [1] ELSE [] END | MERGE (src)-[:DEPENDS_ON]->(refObj))
FOREACH (_ IN CASE WHEN refObj IS NULL AND refView IS NOT NULL THEN [1] ELSE [] END | MERGE (src)-[:DEPENDS_ON]->(refView))
FOREACH (_ IN CASE WHEN refObj IS NULL AND refView IS NULL AND refTab IS NOT NULL THEN [1] ELSE [] END | MERGE (src)-[:DEPENDS_ON]->(refTab))
FOREACH (_ IN CASE WHEN refObj IS NULL AND refView IS NULL AND refTab IS NULL AND refSyn IS NOT NULL THEN [1] ELSE [] END | MERGE (src)-[:DEPENDS_ON]->(refSyn));
```

QC:

```cypher
MATCH (o:DbObject {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS objects;
MATCH (v:View {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS views;
MATCH (p:PLSQLUnit {db:toUpper(trim($DB_NAME))}) RETURN count(*) AS plsql_units;
MATCH (:DbObject {db:toUpper(trim($DB_NAME))})-[:DEPENDS_ON]->() RETURN count(*) AS dep_links;
```

Критерій: всі count > 0 (якщо відповідний CSV не порожній).

---

### Крок 11. COMMENTS (table/column)

**Для чого:** семантика даних.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L0.8.1.COMMENTS.csv' AS row
WITH row,
     toUpper(trim(coalesce(row.OWNER,''))) AS owner,
     toUpper(trim(coalesce(row.TABLE_NAME,''))) AS table_name,
     toUpper(trim(coalesce(row.COLUMN_NAME,''))) AS column_name,
     trim(coalesce(row.COMMENTS,row.COMMENT_TEXT,'')) AS comment_text
WHERE owner<>'' AND table_name<>'' AND comment_text<>''
FOREACH (_ IN CASE WHEN column_name='' THEN [1] ELSE [] END |
  MERGE (cm:DbObject {id:'OBJ|' + toUpper(trim($DB_NAME)) + '|' + owner + '|COMMENT|TABLE.' + table_name})
    ON CREATE SET cm.db=toUpper(trim($DB_NAME)), cm.owner=owner, cm.object_type='COMMENT', cm.name='TABLE.' + table_name
  SET cm.text=comment_text
)
FOREACH (_ IN CASE WHEN column_name<>'' THEN [1] ELSE [] END |
  MERGE (cm:DbObject {id:'OBJ|' + toUpper(trim($DB_NAME)) + '|' + owner + '|COMMENT|COLUMN.' + table_name + '.' + column_name})
    ON CREATE SET cm.db=toUpper(trim($DB_NAME)), cm.owner=owner, cm.object_type='COMMENT', cm.name='COLUMN.' + table_name + '.' + column_name
  SET cm.text=comment_text
);

// links
MATCH (cm:DbObject {db:toUpper(trim($DB_NAME)), object_type:'COMMENT'})
WHERE cm.name STARTS WITH 'TABLE.'
WITH cm, split(cm.name,'.')[1] AS tname
MATCH (t:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|' + cm.owner + '|' + tname})
MERGE (t)-[:HAS_COMMENT]->(cm);

MATCH (cm:DbObject {db:toUpper(trim($DB_NAME)), object_type:'COMMENT'})
WHERE cm.name STARTS WITH 'COLUMN.'
WITH cm, split(cm.name,'.') AS p
MATCH (c:Column {id:'COL|' + toUpper(trim($DB_NAME)) + '|' + cm.owner + '|' + p[1] + '|' + p[2]})
MERGE (c)-[:HAS_COMMENT]->(cm);
```

QC:

```cypher
MATCH (:Table {db:toUpper(trim($DB_NAME))})-[:HAS_COMMENT]->(:DbObject {object_type:'COMMENT'}) RETURN count(*) AS table_comments;
MATCH (:Column {db:toUpper(trim($DB_NAME))})-[:HAS_COMMENT]->(:DbObject {object_type:'COMMENT'}) RETURN count(*) AS column_comments;
```

Критерій: count відповідає очікуванням джерела.

---

### Крок 12. METADATA (технічний аудит імпорту)

**Для чого:** provenance, версія екстракту, час знімка.

```cypher
LOAD CSV WITH HEADERS FROM 'file:///L1.13.METADATA.csv' AS row
MATCH (d:Database {id:'DB|' + toUpper(trim($DB_NAME))})
SET d.extract_version = trim(coalesce(row.EXTRACT_VERSION,'')),
    d.extract_ts = trim(coalesce(row.EXTRACT_TS,'')),
    d.source_system = trim(coalesce(row.SOURCE_SYSTEM,'')),
    d.metadata_raw = row;
```

QC:

```cypher
MATCH (d:Database {id:'DB|' + toUpper(trim($DB_NAME))})
RETURN d.extract_version, d.extract_ts, d.source_system LIMIT 1;
```

Критерій: ключові поля заповнені.

---

## 6) Фінальні інтеграційні перевірки (must-pass)

```cypher
// 1) Унікальність id (діагностика аномалій)
MATCH (n)
WITH labels(n) AS lbl, n.id AS id, count(*) AS c
WHERE id IS NOT NULL AND c > 1
RETURN lbl, id, c LIMIT 50;

// 2) Сироти Column
MATCH (c:Column {db:toUpper(trim($DB_NAME))})
WHERE NOT ()-[:HAS_COLUMN]->(c)
RETURN count(*) AS orphan_columns;

// 3) Сироти Constraint
MATCH (c:Constraint {db:toUpper(trim($DB_NAME))})
WHERE NOT ()-[:HAS_CONSTRAINT]->(c)
RETURN count(*) AS orphan_constraints;

// 4) FK без цілі
MATCH (fk:Constraint {db:toUpper(trim($DB_NAME)), constraint_type:'R'})
WHERE NOT (fk)-[:FK_REFERENCES]->()
RETURN count(*) AS fk_without_ref;

// 5) Перевірка розподілу вузлів
MATCH (n)
RETURN labels(n) AS labels, count(*) AS cnt
ORDER BY cnt DESC;
```

Критерій завершення pipeline: сироти/аномалії в межах узгодженого порогу або пояснені документовано.

---

## 7) Операційний runbook при типових інцидентах

1. **`No changes, no records`**
   - `RETURN count(*)` по файлу з альтернативним delimiter.
   - Перевірити `WHERE` фільтри, тимчасово прибрати й подивитись sample.

2. **`Cannot merge ... null property`**
   - Додати `WITH ... WHERE key<>''` прямо перед `MERGE`.
   - Логувати відбраковані рядки:
     ```cypher
     LOAD CSV WITH HEADERS FROM 'file:///X.csv' AS row
     WITH row, toUpper(trim(coalesce(row.OWNER,''))) AS owner
     WHERE owner=''
     RETURN count(*) AS dropped_rows;
     ```

3. **`ExternalResourceFailed`**
   - Перевірити, що файл у `import` директорії Neo4j.
   - Перевірити точне ім’я, реєстр, кодування.

4. **`22N31 invalid properties`**
   - Не робити `SET n += row` напряму.
   - Призначати властивості явно, з кастами.

---

## 8) Подальший аналіз на основі графа

### 8.1 Центральність схем/таблиць (критичні вузли)

```cypher
// Degree centrality по таблицях через FK
MATCH (t:Table {db:toUpper(trim($DB_NAME))})
OPTIONAL MATCH (t)<-[:FK_SOURCE_TABLE]-(:Constraint)
WITH t, count(*) AS in_deg
OPTIONAL MATCH (t)<-[:FK_TARGET_TABLE]-(:Constraint)
RETURN t.schema, t.name, in_deg + count(*) AS degree
ORDER BY degree DESC LIMIT 20;
```

### 8.2 Impact analysis змін таблиці

```cypher
MATCH (t:Table {id:'TAB|' + toUpper(trim($DB_NAME)) + '|HR|EMPLOYEES'})
OPTIONAL MATCH path=(t)<-[:FK_TARGET_TABLE]-(:Constraint)<-[:HAS_CONSTRAINT]-(:Table)
RETURN path LIMIT 200;
```

### 8.3 Приховані залежності через View/Synonym

```cypher
MATCH p=(o:DbObject {db:toUpper(trim($DB_NAME))})-[:DEPENDS_ON*1..4]->(x)
WHERE any(n IN nodes(p) WHERE n:Synonym OR n:View)
RETURN p LIMIT 100;
```

### 8.4 Пошук циклів залежностей

```cypher
MATCH p=(o:DbObject {db:toUpper(trim($DB_NAME))})-[:DEPENDS_ON*1..8]->(o)
RETURN o.name, length(p) AS cycle_len
ORDER BY cycle_len DESC LIMIT 20;
```

### 8.5 Топ-об’єкти за впливом (fan-out)

```cypher
MATCH (o:DbObject {db:toUpper(trim($DB_NAME))})
OPTIONAL MATCH (o)-[:DEPENDS_ON*1..3]->(x)
WITH o, count(DISTINCT x) AS impact_span
RETURN o.owner, o.object_type, o.name, impact_span
ORDER BY impact_span DESC LIMIT 30;
```

### 8.6 Кластеризація “data domains” (weakly connected components)

> Якщо встановлено GDS:

```cypher
CALL gds.graph.project(
  'metaGraph',
  ['Table','View','DbObject','Synonym'],
  {
    DEPENDS_ON: {orientation:'NATURAL'},
    FK_REFERENCES: {orientation:'NATURAL'},
    SYNONYM_OF: {orientation:'NATURAL'}
  }
);

CALL gds.wcc.stream('metaGraph')
YIELD nodeId, componentId
RETURN componentId, count(*) AS size
ORDER BY size DESC LIMIT 20;
```

### 8.7 Ризики змін (високий in-degree + транзитивність)

```cypher
MATCH (t:Table {db:toUpper(trim($DB_NAME))})
OPTIONAL MATCH (t)<-[:FK_TARGET_TABLE]-(:Constraint)
WITH t, count(*) AS direct_fk_dependents
OPTIONAL MATCH (t)<-[:DEPENDS_ON*1..3]-(:DbObject)
WITH t, direct_fk_dependents, count(*) AS code_dependents
RETURN t.schema, t.name, direct_fk_dependents, code_dependents,
       (direct_fk_dependents*2 + code_dependents) AS risk_score
ORDER BY risk_score DESC LIMIT 25;
```

---

## 9) Мінімальний порядок виконання (checklist)

1. Створити constraints/indexes (розділ 3).
2. Перевірити кожен CSV: delimiter/header/BOM (розділ 4).
3. Кроки 1→12 по порядку (розділ 5).
4. Після кожного кроку запускати QC цього кроку.
5. Запустити фінальні інтеграційні перевірки (розділ 6).
6. Тільки після цього переходити до аналітики (розділ 8).

Це дає відтворюваний “з нуля” процес для будь-якої Oracle БД за умови наявності dictionary CSV.

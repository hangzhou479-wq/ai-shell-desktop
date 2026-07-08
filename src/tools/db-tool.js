/**
 * 数据库操作工具
 * 支持 SQLite（无需额外安装）和 MySQL/PostgreSQL（需有客户端）
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runSQLite(dbPath, sql) {
  const absPath = path.resolve(dbPath);
  if (!fs.existsSync(absPath)) return `数据库文件不存在: ${absPath}`;

  try {
    const result = execSync(`sqlite3 -header -csv "${absPath}" "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    return result.trim() || '(查询成功，无返回数据)';
  } catch (err) {
    return `SQL 执行错误: ${err.stderr || err.message}`;
  }
}

module.exports = {
  dbQuery: async function({ db_path, sql, db_type = 'sqlite' }) {
    if (db_type === 'sqlite') {
      const result = runSQLite(db_path, sql);
      const lines = result.split('\n');
      if (lines.length > 50) {
        return result.split('\n').slice(0, 51).join('\n') + `\n... (共 ${lines.length} 行，已截断)`;
      }
      return result;
    }
    return `暂不支持 ${db_type} 类型。当前支持: sqlite`;
  },

  dbTables: async function({ db_path }) {
    const result = runSQLite(db_path, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    return `数据库 ${db_path} 的表:\n${result}`;
  },

  dbSchema: async function({ db_path, table }) {
    const result = runSQLite(db_path, `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';`);
    return `表 ${table} 结构:\n${result}`;
  },

  dbExecute: async function({ db_path, sql }) {
    return runSQLite(db_path, sql);
  },
};

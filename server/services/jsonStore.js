const fs = require('fs');
const path = require('path');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class JsonStore {
  constructor(filePath, defaultValue) {
    this.filePath = filePath;
    this.defaultValue = clone(defaultValue);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  read() {
    if (!fs.existsSync(this.filePath)) {
      this.write(this.defaultValue);
      return clone(this.defaultValue);
    }

    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (error) {
      const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
      try {
        fs.copyFileSync(this.filePath, backupPath);
      } catch (_) {
        // A falha de backup nao deve impedir o servidor de recuperar o valor padrao.
      }
      console.error(`[JsonStore] JSON invalido em ${this.filePath}. Backup: ${backupPath}`, error.message);
      this.write(this.defaultValue);
      return clone(this.defaultValue);
    }
  }

  write(value) {
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    try {
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      try {
        if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
        fs.renameSync(tempPath, this.filePath);
      } catch (fallbackError) {
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
        throw fallbackError;
      }
    }
    return value;
  }
}

module.exports = { JsonStore };

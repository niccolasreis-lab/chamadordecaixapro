const CountryService = require('../CountryService');

class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  async buscarJogosHoje(competicao) {
    throw new Error(`Método "buscarJogosHoje" não implementado no provedor ${this.name}.`);
  }

  async buscarProximosJogos(competicao) {
    throw new Error(`Método "buscarProximosJogos" não implementado no provedor ${this.name}.`);
  }

  async buscarClassificacao(competicao) {
    throw new Error(`Método "buscarClassificacao" não implementado no provedor ${this.name}.`);
  }

  formatarData(dataIso) {
    const d = new Date(dataIso);
    const hj = new Date();
    const isHoje = d.getDate() === hj.getDate() && d.getMonth() === hj.getMonth() && d.getFullYear() === hj.getFullYear();
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isHoje) return `Hoje — ${hora}`;
    const amanha = new Date(hj);
    amanha.setDate(amanha.getDate() + 1);
    const isAmanha = d.getDate() === amanha.getDate() && d.getMonth() === amanha.getMonth() && d.getFullYear() === amanha.getFullYear();
    if (isAmanha) return `Amanhã — ${hora}`;
    return `${d.toLocaleDateString('pt-BR')} — ${hora}`;
  }

  normalizarTime(teamName) {
    if (!teamName) return 'A definir';
    return CountryService.translate(teamName);
  }

  getHealthInfo() {
    return null;
  }
}

module.exports = BaseProvider;

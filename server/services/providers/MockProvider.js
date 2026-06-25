const BaseProvider = require('./BaseProvider');
const CountryService = require('../CountryService');

class MockProvider extends BaseProvider {
  constructor() {
    super('MockProvider');
  }

  normalizarJogos(matches) {
    if (!matches) return [];
    return matches.map(jogo => {
      const homeName = jogo.homeTeam ? jogo.homeTeam.name : 'A definir';
      const awayName = jogo.awayTeam ? jogo.awayTeam.name : 'A definir';

      const homeMeta = CountryService.getMetadata(homeName);
      const awayMeta = CountryService.getMetadata(awayName);

      return {
        id: jogo.id,
        data: jogo.utcDate,
        status: jogo.status,
        statusTexto: this.formatarData(jogo.utcDate),
        mandante: this.normalizarTime(homeName),
        visitante: this.normalizarTime(awayName),
        placarMandante: jogo.placarMandante !== undefined ? jogo.placarMandante : null,
        placarVisitante: jogo.placarVisitante !== undefined ? jogo.placarVisitante : null,
        fase: jogo.fase || 'GROUP_STAGE',
        grupo: jogo.grupo || 'Group A',
        crestMandante: jogo.homeTeam ? jogo.homeTeam.crest : null,
        crestVisitante: jogo.awayTeam ? jogo.awayTeam.crest : null,
        countryMandanteCode: homeMeta ? homeMeta.iso2 : null,
        countryVisitanteCode: awayMeta ? awayMeta.iso2 : null,
        lastUpdated: new Date().toISOString()
      };
    });
  }

  async buscarJogosHoje(competicao) {
    console.log('[Mock Provider] Retornando jogos simulados de hoje...');
    const nowStr = new Date().toISOString();
    const mockToday = [
      {
        id: 801,
        utcDate: nowStr,
        status: 'IN_PLAY',
        homeTeam: { name: 'Brazil', crest: 'https://crests.football-data.org/764.svg' },
        awayTeam: { name: 'France', crest: 'https://crests.football-data.org/fr.svg' },
        placarMandante: 0,
        placarVisitante: 0,
        fase: 'GROUP_STAGE',
        grupo: 'Group C'
      },
      {
        id: 802,
        utcDate: nowStr,
        status: 'FINISHED',
        homeTeam: { name: 'Argentina', crest: 'https://crests.football-data.org/ar.svg' },
        awayTeam: { name: 'Mexico', crest: 'https://crests.football-data.org/769.svg' },
        placarMandante: 2,
        placarVisitante: 0,
        fase: 'GROUP_STAGE',
        grupo: 'Group J'
      }
    ];

    return this.normalizarJogos(mockToday);
  }

  async buscarProximosJogos(competicao) {
    const tmrStr = new Date(Date.now() + 86400000).toISOString();
    const mockUpcoming = [
      {
        id: 803,
        utcDate: tmrStr,
        status: 'TIMED',
        homeTeam: { name: 'Spain', crest: 'https://crests.football-data.org/es.svg' },
        awayTeam: { name: 'Italy', crest: 'https://crests.football-data.org/it.svg' },
        fase: 'GROUP_STAGE',
        grupo: 'Group H'
      },
      {
        id: 804,
        utcDate: tmrStr,
        status: 'TIMED',
        homeTeam: { name: 'United States', crest: 'https://crests.football-data.org/usa.svg' },
        awayTeam: { name: 'Portugal', crest: 'https://crests.football-data.org/pt.svg' },
        fase: 'GROUP_STAGE',
        grupo: 'Group D'
      }
    ];

    return this.normalizarJogos(mockUpcoming);
  }

  async buscarClassificacao(competicao) {
    return [
      {
        stage: 'GROUP_STAGE',
        type: 'TOTAL',
        group: 'Grupo C',
        table: [
          {
            position: 1,
            team: { id: 764, name: 'Brasil', crest: 'https://crests.football-data.org/764.svg' },
            playedGames: 1,
            won: 1,
            draw: 0,
            lost: 0,
            points: 3,
            goalsFor: 2,
            goalsAgainst: 0,
            goalDifference: 2
          },
          {
            position: 2,
            team: { id: 759, name: 'Alemanha', crest: 'https://crests.football-data.org/759.svg' },
            playedGames: 1,
            won: 0,
            draw: 0,
            lost: 1,
            points: 0,
            goalsFor: 0,
            goalsAgainst: 2,
            goalDifference: -2
          }
        ]
      }
    ];
  }
}

module.exports = MockProvider;

/**
 * Tipagem para dados institucionais do estabelecimento.
 */

export interface InstitucionalData {
  nome: string;
  telefone: string;
  site: string;
  instagram: string;
  slogan: string;
  logo: string;
  qrcode: string;
  mostrarNome?: boolean;
  mostrarTelefone?: boolean;
  mostrarSite?: boolean;
  mostrarInstagram?: boolean;
  mostrarSlogan?: boolean;
  mostrarQRCode?: boolean;
}

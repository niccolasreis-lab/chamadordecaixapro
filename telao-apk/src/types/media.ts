/**
 * Tipagem para mídias e streams do telão.
 */

export interface Media {
  id: string;
  tipo: 'imagem' | 'video' | 'youtube_stream' | string; // inclui tipos copa_*
  url: string;
  ativo: boolean;
  ordem?: number;
  duracao?: number;
  tempo?: number;
  reproduzirPrimeiro?: boolean;
}

export interface Stream {
  id: string;
  url: string;
  ativo: boolean;
}

export interface MappedStream {
  id: string;
  youtubeId: string;
  url: string;
}

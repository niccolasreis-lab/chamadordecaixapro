# Plano de Implementação: Narração de Caixa via Áudio MP3 Customizado

O objetivo é permitir que o Telão reproduza arquivos de áudio MP3 gravados de forma personalizada (armazenados em uma pasta local) quando um caixa chamar uma senha. Se o arquivo correspondente não existir, o sistema fará o fallback automático para a síntese de voz (TTS) do navegador.

## Proposed Changes

### Servidor Principal (C:\ChamadorCaixa)

---

#### [MODIFY] [.env](file:///C:/ChamadorCaixa/.env)
- Adicionar a variável `NARRAR_DIR` apontando para a pasta onde estão os áudios gravados:
  ```env
  NARRAR_DIR=C:\Users\operador\Documents\CHAMADOR DE CAIXA PRO\narrar caixa .mp3
  ```

#### [MODIFY] [index.js](file:///C:/ChamadorCaixa/index.js)
- Importar/ler a variável `NARRAR_DIR` do ambiente.
- Se o diretório existir, configurar a rota estática `/narracoes` usando `express.static`:
  ```javascript
  const NARRAR_DIR = process.env.NARRAR_DIR || 'C:\\Users\\operador\\Documents\\CHAMADOR DE CAIXA PRO\\narrar caixa .mp3';
  if (fs.existsSync(NARRAR_DIR)) {
    app.use('/narracoes', express.static(NARRAR_DIR));
    console.log(`[Narracoes] Servindo áudios de: ${NARRAR_DIR}`);
  } else {
    console.warn(`[Narracoes] Diretório de narrações não encontrado: ${NARRAR_DIR}`);
  }
  ```

---

### Telão Web App (telao-apk)

---

#### [MODIFY] [ChamadaOverlay.tsx](file:///c:/Users/operador/Documents/SAAS/chamador%20de%20caixa%20pro%20versao%202.0/CHAMADOR%20DE%20CAIXA%20PRO/telao-apk/src/components/chamada/ChamadaOverlay.tsx)
- No método `playSound()`, após a execução do sinal sonoro (beep/chime) eletrônico e após o timeout de 750ms:
  1. Identificar o tipo do caixa (`tipo` do ticket: preferencial, rápido, ou normal).
  2. Determinar o nome do arquivo MP3 esperado:
     - Se `tipo` for preferencial: `caixa livre_${caixa}_preferencial.mp3`
     - Se `tipo` for rápido: `caixa livre_${caixa}_rapido.mp3`
     - Caso contrário: `caixa livre_${caixa}.mp3`
  3. Resolver a URL do áudio: `${resolvedServerUrl}/narracoes/${encodeURIComponent(filename)}`.
  4. Tentar reproduzir o arquivo usando `new Audio(audioUrl)` (em ambiente Web/WebView):
     - Adicionar o manipulador `onerror` e capturar rejeições de `play()`.
     - Caso ocorra erro 404 (arquivo não encontrado) ou falha de autoplay bloqueado pelo navegador, disparar o fallback da síntese de voz original (`window.speechSynthesis.speak(utterance)`).

---

## Verification Plan

### Automated Steps
1. Compilar os arquivos do Telão:
   ```powershell
   npx expo export --platform web
   ```
2. Copiar os novos arquivos para `C:\ChamadorCaixa\dist`.

### Manual Verification
1. Verificar no console do servidor Express se a mensagem `[Narracoes] Servindo áudios de: ...` foi exibida.
2. Abrir o Telão no navegador em `http://localhost:3040/`.
3. Executar chamadas de testes pelo painel do Operador/PDV:
   - Chamar Caixa 1 (Normal) -> deve tocar o chime eletrônico e depois o áudio `caixa livre_1.mp3`.
   - Chamar Caixa 3 (Preferencial) -> deve tocar o chime e depois o áudio `caixa livre_3_preferencial.mp3`.
   - Chamar Caixa 6 (Não existente na pasta) -> deve tocar o chime e depois falar por síntese de voz (TTS).

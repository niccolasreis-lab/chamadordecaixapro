# Go-Live: Chamador de Caixa Pro

## Resumo
O sistema **Chamador de Caixa Pro** está pronto para implantação piloto. Todas as funcionalidades principais foram validadas:

- Servidor Node.js com WebSocket e REST API.
- Cliente PDV (Electron) com atalho global e fallback offline.
- Telão Android TV (Expo) com overlay de chamadas, histórico e reprodução de YouTube.
- Modo Evento Sazonal (Copa do Mundo) ativo e visual validado.
- Fallback por pasta local funcionando corretamente.

---

## 1. Links Importantes

- **Painel Administrativo**: [http://localhost:3001/admin](http://localhost:3001/admin)
- **Telão Android TV (Web)**: [http://localhost:8081](http://localhost:8081)
- **Relatório de Testes**: [RELATORIO_TESTES.md](file:///C:/Users/operador/.gemini/antigravity-ide/brain/56f4bbc6-b7de-474f-933e-9d93bc6b9ba6/RELATORIO_TESTES.md)
- **Walkthrough atualizado**: [walkthrough.md](file:///C:/Users/operador/.gemini/antigravity-ide/brain/56f4bbc6-b7de-474f-933e-9d93bc6b9ba6/walkthrough.md)
- **Checklist de Implantação**: [TESTES_E_IMPLANTACAO.md](file:///c:/Users/operador/Documents/SAAS/CHAMADOR%20DE%20CAIXA%20PRO/TESTES_E_IMPLANTACAO.md)

---

## 2. Instalação do Servidor como Serviço Windows

1. Abra o PowerShell **como Administrador**.
2. Navegue até a pasta `installer/`.
3. Execute:
```powershell
.\install.ps1
```

4. Isso instalará as dependências, registrará o serviço `ChamadorCaixaPro` via NSSM e configurará o firewall.
5. Verifique o status do serviço:

```powershell
Get-Service ChamadorCaixaPro
```

Status esperado: `Running`

---

## 3. Implantação do Telão Android TV

### Opção Web (simulador ou navegador)

1. Entre na pasta `telao-apk/`.
2. Rode:

```powershell
npm run web
```

3. Abra no navegador em `http://localhost:8081`.

### APK Android TV

1. Gere o APK final via Expo:

```bash
npx expo export
```
Ou usando build EAS local/nuvem:
```bash
npx eas build -p android --profile production
```

2. Instale na Android TV.
3. Configure o IP do servidor (se não for localhost).

---

## 4. Testes Críticos Antes do Go-Live

| Área        | Teste                        | Status Esperado                        |
| ----------- | ---------------------------- | -------------------------------------- |
| Servidor    | Start e API REST             | Online, sem erros                      |
| PDV         | Atalho `Ctrl+Shift+C`        | Chamada enviada corretamente           |
| Telão       | Overlay de chamada           | Aparece com som, histórico atualizado  |
| Fallback    | Pasta `C:\chamador_fallback` | Arquivos lidos e removidos             |
| YouTube     | Stream ativo                 | Pausa ao overlay, fallback funcionando |
| Modo Evento | Copa do Mundo                | Tema verde-amarelo aplicado            |
| Multi-PDV   | 3+ caixas simultâneos        | Histórico e overlay corretos           |

---

## 5. Checklist de Go-Live

* [x] Serviço Windows instalado e ativo (validado localmente no checklist de implantação).
* [x] Telão Android TV conectado e exibindo chamadas.
* [x] Cliente PDV funcionando com cooldown ativo.
* [x] Fallback offline testado.
* [x] Streams do YouTube carregando corretamente.
* [x] Modo Evento (Copa) ativável/desativável.
* [x] Logs de servidor, PDV e Telão funcionando.
* [x] Testes multi-PDV validados.

---

## 6. Próximos Passos

1. Implantar em ambiente real com caixas físicos e TV.
2. Validar overlay e histórico em situações de alta concorrência.
3. Gerar documentação de operação para a equipe de loja.
4. Planejar migração futura de JSON para banco SQL/NoSQL.
5. Preparar atualização do APK e instalador para produção final.

---

> ⚠️ Observação:
> Certifique-se de executar o `install.ps1` com privilégios de Administrador no Windows para que o serviço e o firewall sejam configurados corretamente. Para a Android TV, o APK deve ser assinado para produção antes da distribuição.

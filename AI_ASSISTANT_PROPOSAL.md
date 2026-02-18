# Voice Assistant Integration - PersonaPlex-7B-v1

## O que é o PersonaPlex-7B-v1?

Modelo de linguagem da NVIDIA com 7 bilhões de parâmetros, desenhado para conversação natural e capacidade de explicar conceitos técnicos. O tamanho é ideal - grande o suficiente para ser inteligente, pequeno o suficiente para rodar local numa GPU decente.

## Abordagens possíveis

### 1. Bundled no instalador (local puro)

Meter o modelo quantizado (4GB) diretamente no instalador. O user instala e já tem tudo.

**Prós:**
- Funciona offline sempre
- Zero custos de API
- Privacidade total
- Latência baixíssima com GPU

**Contras:**
- Instalador fica com ~4.5GB
- Precisa GPU RTX 2060+ para ser fluído
- Demora ~30s a carregar o modelo na primeira vez

### 2. Download on-demand

Instalador small, na primeira vez que activar o voice assistant faz download.

**Prós:**
- Instalador fica leve
- User escolhe se quer ou não
- Pode actualizar modelo facilmente

**Contras:**
- Precisa net rápida (4GB)
- Primeira experiência demora

### 3. Híbrido cloud/local

Detecta hardware. Se tiver GPU boa usa local, senão usa API externa.

**Prós:**
- Funciona em qualquer hardware
- Users com GPU boa têm experiência premium

**Contras:**
- Mais complexo de manter
- Custos de API para users sem GPU
- Questões de privacidade no modo cloud

## Recomendação: Opção 2 (download on-demand)

Instalador fica normal, e durante o setup ou no primeiro launch:

```
┌────────────────────────────────────┐
│ Voice Assistant                    │
│                                    │
│ Download AI model? (4.2 GB)        │
│ • Voice commands                   │
│ • Feature explanations             │
│ • Real-time suggestions            │
│                                    │
│ [Download] [Skip]                  │
└────────────────────────────────────┘
```

Se skip, pode sempre activar depois nas settings.

## Features implementáveis

### Voice commands

```
"optimize for cs2"        → roda full optimization suite
"show crosshair settings" → abre CFG tab, vai para crosshair section
"ping faceit servers"     → roda network test
"what's this?"            → explica o toggle onde está o rato
```

Push-to-talk com Ctrl+Space.

### Feature explanations

Cada toggle tem botão para perguntar. AI explica em linguagem simples:

```
User: "what does HPET do?"
AI: "HPET é um timer antigo do Windows. O problema 
     é que força o CPU a verificá-lo constantemente, 
     o que adiciona 2-3ms de delay. CPUs modernos têm
     timers melhores. Desactivar isto reduz input lag."
```

### Real-time monitoring

AI corre em background, monitora performance:

```
AI: "Discord tá a usar 15% da tua GPU. Queres que
     desactive o hardware acceleration dele?"
```

### Conversational setup

Em vez de user andar às cegas pelos toggles:

```
AI: "Detectei: Ryzen 7 5800X, RTX 3080, 32GB RAM.
     Vejo 23 optimizações possíveis. Começamos?"

User: "sim"

AI: "Ok, 5 quick wins:
     - Game DVR tá ligado, vou matar
     - Transparência do Windows, vou desligar
     - HPET timer, vou remover
     - Core parking, vou desactivar
     - SysMain service, vou parar
     
     Isto deve dar +22 fps e -3ms latency.
     Continuo com as advanced?"
```

## Stack técnico

### Backend (Rust)
- llama.cpp para inference (melhor performance)
- Whisper.cpp para speech-to-text
- Load model em background thread
- Commands executam via existing PowerShell system

### Frontend (TypeScript)
- Chat sidebar UI
- Audio capture para voice input
- Highlight toggles quando AI explica
- Progress indicator enquanto AI processa

### Models
- PersonaPlex-7B quantizado (4-bit) → 4.2GB
- Whisper base.en → 148MB
- Piper TTS (opcional, para voice output) → 120MB
- Total: ~4.5GB

## Implementação faseada

### Fase 1: Text chat (2 semanas)
- Integrar llama.cpp
- UI básica de chat
- Explicações de features
- Knowledge base com info dos 96 tweaks

### Fase 2: Voice input (2 semanas)
- Whisper integration
- Push-to-talk
- Voice commands básicos
- Testes de latência

### Fase 3: Advanced (3 semanas)
- TTS para voice output
- Background monitoring
- Proactive suggestions
- Multiple personas (pro, casual, coach)

## Hardware requirements

**Minimum (CPU only):**
- Any modern CPU
- 8GB RAM
- Latency: 2-5s per response (slow but works)

**Recommended (GPU):**
- RTX 2060 ou superior
- 8GB VRAM
- Latency: 200-500ms (fluído)

**Optimal:**
- RTX 3060+
- 12GB VRAM
- Latency: <200ms (instantâneo)

## Custos

### Local (recomendado)
- Download bandwidth: ~$0.02 por user (one-time)
- Compute: $0 (user's hardware)
- Manutenção: $0
- **Total por user: ~$0.02 one-time**

### Cloud (alternativa)
- API calls: ~$0.001 por request
- User médio: ~500 requests/mês = $0.50/mês
- 1000 users: $500/mês
- **Total: caro demais, não vale a pena**

Local é claramente melhor economicamente.

## Privacy & Security

Tudo local:
- Nenhum dado sai do PC do user
- Voz não é enviada para servers
- Conversations não são logged (ou só local se user quiser)
- Model weights verificados com signature

Opcional: telemetria anónima (opt-in) para melhorar o sistema.

## Diferencial competitivo

GeForce Experience: não tem voice, não explica nada
Razer Cortex: optimization genérico, sem contexto CS2
aim.camp Player Agent: AI que explica cada tweak e guia o user

**Ninguém mais tem isto no espaço de gaming optimization tools.**

## Technical challenges

1. **Model load time** - Solução: load em background, show progress
2. **GPU memory** - Solução: 4-bit quantization, apenas 4GB VRAM needed
3. **Latency em low-end** - Solução: oferecer modo "Quick mode" (less context)
4. **User não tem mic** - Solução: text chat sempre funciona

## Exemplos de uso concreto

**Scenario 1: New user**
```
User instala, abre app.
AI: "Primeira vez? Posso fazer um scan rápido e 
     optimizar automaticamente?"
User: "sim"
AI: *analisa, aplica tweaks safe*
    "Pronto. +35 fps estimado. Quer ver o que mudei?"
```

**Scenario 2: Troubleshooting**
```
User: "o meu fps tá a dropar random"
AI: *verifica processes*
    "Chrome tem 47 tabs abertos e tá a usar 4GB RAM.
     Discord hardware accel ligado. Windows Update
     a correr em background. Fecho isto tudo?"
```

**Scenario 3: Learning**
```
User passa rato sobre toggle "Disable HPET"
AI: *voz suave* "HPET é um timer old school. 
     Remove para -2ms input lag no teu setup."
```

## UI integration

Chat sidebar em todas as tabs, sempre acessível. Ctrl+Space para voice em qualquer altura.

Cada section (SYS, CFG, HW, etc) tem context awareness - AI sabe onde user está e adapta respostas.

Modo "Coach": AI fala proactivamente durante gameplay (ex: "temp da GPU 83°C, tudo ok")

## Knowledge base structure

```
knowledge/
├── features/
│   ├── windows-tweaks.json     # 96 tweaks explicados
│   ├── cfg-commands.json       # 150+ autoexec commands
│   └── common-issues.json      # troubleshooting database
├── hardware/
│   ├── cpu-database.json       # specs conhecidas
│   ├── gpu-database.json
│   └── compatibility.json
└── personas/
    ├── pro.txt                 # Formal, data-driven
    ├── coach.txt               # Friendly, encouraging
    └── casual.txt              # Relaxed, simple
```

AI usa isto como RAG (retrieval augmented generation) para dar respostas precisas.

## Performance targets

- Model load: <30s em RTX 3060
- Voice response: <500ms (p90)
- Memory: <2GB com model loaded
- CPU usage idle: <1%
- Accuracy voice commands: >95%

## Roadmap rápido

Semana 1-2: Proof of concept (llama.cpp + basic chat)
Semana 3-4: Voice input working
Semana 5-6: Knowledge base completa
Semana 7-8: Polish UI, testing, alpha release

**Total: 2 meses para MVP completo**

## Conclusão

PersonaPlex-7B é perfeito para isto:
- Tamanho ideal (não é overkill nem underkill)
- Optimizado para NVIDIA GPUs (target audience tem estas)
- Multi-persona capability
- Local-first (privacy + zero costs)

Bundling no instalador como optional download é a melhor approach. User vê valor, faz download, experiência fica 10x melhor.

**Isto transforma player-agent de "optimization tool" para "AI gaming coach"** - completamente diferente do que existe no mercado.

Worth it? 100%.

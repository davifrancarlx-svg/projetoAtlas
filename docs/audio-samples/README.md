# Amostras de som para revisão

- `acerto.wav`: duas notas ascendentes, primeira das três variações do jogo.
- `erro.wav`: nota baixa curta, também usada quando o tempo acaba.
- `conquista.wav`: três notas, substitui o acerto quando ambos acontecem juntos.

Geradas em Chrome real com `OfflineAudioContext` e a função `AtlasAudio.render` de `src/audio.js`, em volume médio (0,23), mono, 48 kHz, PCM de 16 bits. Cada arquivo tem meio segundo, incluindo o silêncio final. O volume percebido depende do volume de reprodução e do aparelho.

São amostras de revisão, não arquivos carregados pelo jogo. O app sintetiza seus próprios efeitos localmente. A aprovação do timbre depende da escuta do usuário; os testes técnicos verificam sinal, duração e ausência de saturação.

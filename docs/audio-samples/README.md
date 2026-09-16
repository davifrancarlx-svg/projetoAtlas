# Amostras de som para revisão

Um arquivo por estilo, com os três efeitos do jogo em sequência: **acerto** em
0 s, **erro** em 0,55 s e **fim de série** em 1,05 s.

- `sino.wav`: senoide com um harmônico fraco. É o estilo padrão.
- `marimba.wav`: ataque imediato, cauda curta e o quarto harmônico marcado — madeira.
- `corda.wav`: onda triangular com três parciais, como uma corda dedilhada.
- `sopro.wav`: ataque lento e cauda longa. O mais discreto dos quatro.

A nota do acerto percorre uma pentatônica de cinco pares antes de repetir, então
a amostra mostra só a primeira volta. O erro cai uma terça menor no grave e o fim
de série resolve em tônica, quinta e oitava.

Geradas em Chrome real com `OfflineAudioContext` e a função `AtlasAudio.render`
de `src/audio.js`, em volume médio (0,23), mono, 48 kHz, PCM de 16 bits. O volume
percebido depende do volume de reprodução e do aparelho.

São amostras de revisão, não arquivos carregados pelo jogo. O app sintetiza seus
próprios efeitos localmente. A aprovação do timbre depende da escuta do usuário;
os testes verificam sinal, duração, ausência de saturação e que dois estilos não
renderizam o mesmo áudio.

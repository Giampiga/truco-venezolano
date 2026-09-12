# Reglas que aplica esta mesa

La aplicación usa una configuración explícita de Truco venezolano. Las reglas
regionales difieren; no se presenta como certificación de un reglamento nacional.

## Cartas y vueltas

Baraja española de 40 cartas, tres por jugador, reparto antihorario y vira visible.
Se admiten dos jugadores o cuatro en parejas alternadas. El mano inicia; quien
gana una vuelta inicia la siguiente. El reparto y el mano rotan en cada base.

La jerarquía, de mayor a menor, es:

1. Perico: 11 de la pinta de la vira.
2. Perica: 10 de la pinta de la vira.
3. As de espadas.
4. As de bastos.
5. Siete de espadas.
6. Siete de oros.
7. Treses.
8. Doses.
9. Ases de oros y copas.
10. Reyes, salvo el que sustituya una pieza.
11. Caballos, salvo el Perico.
12. Sotas, salvo la Perica.
13. Sietes de bastos y copas.
14. Seises.
15. Cincos.
16. Cuatros.

Si la vira es 11 o 10, el 12 de su pinta sustituye esa pieza. La vira no se juega.
Las cartas del mismo nivel empatan. «Cómo jugar» permite cambiar la vira y genera
la escalera con `trucoRank()`, la misma función utilizada por el motor.

Dos vueltas ganadas resuelven la base. Si la segunda o tercera empata, manda la
primera ganada. Si la primera empata entre rivales, cada jugador apila las dos
restantes con la mayor arriba. Solo quienes empatan arriba destapan la otra;
si persiste, gana el primero entre los empatados en orden de mano. La parda
abierta admite cantos durante la presentación; la cerrada no. Dos cartas iguales
de compañeros no generan parda. Las cartas pasadas pierden contra cualquier carta
sin pasar y conservan su valor para contar el Envite.

## Cantos y puntuación

- Truco: 3 → Retruco: 6 → Vale nueve: 9 → Vale juego: el chico.
  Los aumentos alternan equipos; el rechazo paga 1, 3, 6 o 9.
- Envido: empieza en 2; los repiques suman piedras. La falta equivale a lo que
  falta al equipo que va ganando y no puede reducir una apuesta ya pendiente.
  Se canta antes de jugar la primera carta, también al responder un Truco.
- El Envido se cuenta con las tres cartas originales. Dos de la misma pinta
  suman 20 más sus números; las figuras valen cero. Una pieza aporta 30 o 29
  más la mejor otra carta. Sin pareja ni pieza, vale la carta numérica mayor.
  Los empates se resuelven por orden de mano.
- La Flor anula el Envido normal, incluso si ya fue querido. Por eso el Envite
  querido o rechazado se acredita al terminar la base, antes del Truco. Si
  completa el chico, el Truco ya no suma.
- Flor: tres cartas de la misma pinta, una pieza y otras dos de la misma pinta,
  o ambas piezas (Reservada). La Reservada gana la comparación de flores.
- En esta mesa digital se exige anunciar la Flor antes de jugar. «A ley» usa
  esa misma declaración; no implementa el anuncio diferido de algunas mesas.
  Si hay Flor rival, se puede comparar, rechazar o decir «Mi flor envida».
  La apuesta inicial incluye 3 de Flor; envidarla suma 2. Si se rechaza un
  aumento, se paga lo ya apostado. Cada Flor aliada adicional suma 3 al equipo
  ganador. Un jugador sin Flor no responde a una disputa de flores.
- Flor y Envido suspenden un Truco pendiente; después se retoma su respuesta.
  La Flor se acredita al resolverse. Si cierra el chico, termina la base.

La meta puede ser 12, 24 o 32 piedras; se juega un chico o al mejor de tres.
Competitivo fija 24 piedras, un chico, Flor de 3 y primera parda abierta.
No se cambia el reglamento en medio de una base.

## Variantes no implementadas

Privando/Cantando, matar tapado, Muerte segura/falsa, Flor de 4/5, Reservada
«cobra todo» y el anuncio diferido de A ley no están habilitados. Las opciones
antiguas de parda secuencial se normalizan a la parda apilada. El servidor
rechaza la configuración de Flor de 4/5. Las manos siempre son privadas.

## Comprobación

Las pruebas cubren reparto, jerarquía con las 40 viras posibles, empates,
parda apilada, repiques/rechazos, interrupción de Truco, Flor disputada,
cancelación del Envite, prioridad al cerrar el chico y reinicio de la serie.
También completan 36 series sembradas en ambos formatos, los tres niveles de IA
y todas las combinaciones admitidas de Flor/parda. La IA solo recibe su mano,
cartas públicas, marcador y acciones legales. Las pruebas HTTP juegan partidas
completas usando las rutas reales y verifican historia y ranking persistidos.

## Referencias consultadas

- [Ludoteka: cartas, apuestas y prioridad de Envite/Flor](https://www.ludoteka.com/juegos/truco-venezolano/reglas).
- [Manual CODENACOPU/FCCPV: primera parda apilada, reparto y cantos](https://es.slideshare.net/slideshow/el-juego-de-truco-fccpv-mayo-2015/53283996).
- [FEVETRU: modalidades y contexto regional](https://fevetru.com/reglamento).

Consulta de referencias: 12 de septiembre de 2026. Los detalles digitales
anteriores son decisiones explícitas de esta mesa donde las fuentes difieren.

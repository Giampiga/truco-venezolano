# Base ejecutable de reglas

## Preset “Oriental clásico”

- Baraja española de 40, tres cartas y vira.
- Dos jugadores (Mano/Pie) o cuatro jugadores con parejas alternadas;
  reparto antihorario de a una carta y rotación después de cada base.
- A 24 piedras.
- Perico y Perica definidos por la pinta de la vira. Si la Vira es 11, el 12
  de esa pinta sustituye al Perico; si es 10, sustituye a la Perica.
- Truco 3 → Retruco 6 → Vale nueve 9 → Vale juego.
- Flor a ley y Reservada como resultado dominante, sin depender de su cuenta
  numérica disputada.
- Primera parda venezolana apilada, mayor arriba, con modo abierto/cerrado;
  también existe la adaptación secuencial de tres vueltas para mesas rápidas.
- Cartas pasadas activas.
- Cantando/Privando se presenta solo para el chico tradicional de 24, en 23.
- Señas públicas para que toda la mesa pueda verlas.

Este nombre identifica un preset del producto; no afirma que exista un único
reglamento nacional ni un reglamento oficial FEVETRU ya publicado. “Flor por
derecho”, “Pardas cerradas”, el chico a 12, la variante a 32 y la resolución
secuencial se exponen con nombre propio.

## Orden de resolución

1. Flor/Reservada anula el Envite normal y se acredita primero.
2. Envite, repiques y Falta se comparan con la mano completa repartida, aunque
   una carta ya esté sobre la mesa; el empate es para el asiento más Mano.
3. Un Envite legal puede suspender un Truco pendiente y luego reanudarlo.
4. Truco, Retruco, Vale nueve y Vale juego alternan equipos; los rehúses pagan
   1, 3, 6 y 9 respectivamente.
5. Un Vale juego querido continúa la base: quien la gana se lleva el chico.
6. Si Flor/Envite completa el chico primero, el Truco suspendido ya no suma.

## Práctica contra IA

La IA consume una proyección deliberadamente limitada: su reparto original,
cartas propias restantes, Vira, cartas públicas, conteos rivales, marcador,
cantos y comandos legales. No recibe manos rivales, cartas tapadas ajenas ni
el resto del mazo. Las tres dificultades cambian estrategia, no información.
Las pruebas recorren un partido completo a 12, múltiples bases, rotación y
repartos nuevos usando exactamente `transition()`.

## Límites explícitos

- `Muerte segura / Muerte falsa`, Flor que paga 4/5 y Reservada condicionada
  permanecen señaladas como experimentales o desactivadas: FEVETRU las nombra,
  pero todavía no publica transiciones ejecutables completas.
- `Matar tapado` conserva su descripción documentada en la configuración,
  pero no se presenta como automatización competitiva verificada mientras no
  exista cobertura completa de compromiso, revelado y penalización.
- Privando cuenta con activación/comparación determinista a 23; las ramas
  analógicas completas de declaración, prueba y penalización requieren una
  especificación de torneo antes de habilitarse en juego con rating.

## Fuentes consultadas

- Francisco A. Solé, El Juego de Truco, Ediciones SIDOR:
  https://es.scribd.com/doc/215351099/El-Libro-El-Juego-de-Truco-de-Francisco-A-Sole
- Manual competitivo CODENACOPU/FCCPV:
  https://es.slideshare.net/slideshow/el-juego-de-truco-fccpv-mayo-2015/53283996
- Implementación activa de Ludoteka:
  https://www.ludoteka.com/juegos/truco-venezolano/reglas
- Estado y variantes documentadas por FEVETRU:
  https://fevetru.com/reglamento
  https://fevetru.com/pdf/eBook-fevetru-modalidades.pdf
  https://fevetru.com/pdf/eBook-fevetru-jugadas-para-recrear.pdf
- Implementación en línea de Conecta Games:
  https://www.conectagames.com/rules/truco_ve

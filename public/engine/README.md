# Stockfish, as this site ships it

The analysis page (`/:locale/analysis`) runs **Stockfish 19**, a separate program, in a Web
Worker in your browser. The page speaks to it only through UCI text messages. These files are
that program, unmodified.

| File                            | What it is                                        | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `stockfish-19-lite-single.js`   | The loader and worker glue, as built upstream     | `d3344124ab067fb0b90ee77873bb8e9fbf5fc01bc525fe714b0f942581e889e6` |
| `stockfish-19-lite-single.wasm` | The engine and its embedded 1 MiB NNUE network    | `57ac2d72312aba346760e3f173f687a8c211208e97a87268436f7f0e10bb5387` |
| `COPYING.txt`                   | The GNU General Public License, version 3         | `0b383d5a63da644f628d99c33976ea6487ed89aaa59f0b3257992deac1171e6b` |

## Licence

Stockfish is free software, licensed under the **GNU General Public License, version 3**
(`COPYING.txt`). You may copy, modify and redistribute it under those terms. It comes with no
warranty.

The rest of this site is a different program under the MIT licence. It does not link to
Stockfish. It starts this worker and exchanges UCI text with it.

## Source

These are the release files of **stockfish.js 19.0.0** by Nathan Rugg and Chess.com, a
WebAssembly build of Stockfish, published to npm as `stockfish@19.0.0` (git commit
`54fde71d90c7c403964f6cacef48f7bbec495df1`).

- stockfish.js: https://github.com/nmrugg/stockfish.js (tag `v19.0.0`)
- Stockfish itself: https://github.com/official-stockfish/Stockfish
- The network: `nn-61e7af4bb97d`, https://tests.stockfishchess.org/nns?network_name=nn-61e7af4bb97d

Nothing here has been changed. Replacing these files with your own build is a matter of
putting a file with the same name here.

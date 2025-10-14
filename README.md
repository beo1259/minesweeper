## minesweeper

the classic Minesweeper game. includes a solver to show viable moves for any given board state.

## running locally

**from root repository directory...**

in 1 terminal window

1. `npx tsc --watch` (compiles the ts files into js)

in separate terminal window:

2. `npx serve` (runs on port 3000 by default, use the '-l' flag to use a different port. ie. `npx serve -l 8080`)
 
## still being worked on

- solver algorithm is not optimized and may take a while/crash the page on larger states (ie. midway through expert games)
- on larger board sizes, the board sometimes covers the left side box (flag count, mines, high scores button)

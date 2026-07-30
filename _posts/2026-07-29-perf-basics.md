---
layout: post
title:  "Medindo Desempenho com perf: Coleta de Eventos de CPU"
date:   2026-07-29 20:56:24 -0300
author: Gilmar Sales
categories: linux performance profiling
tags: [linux, perf, profiling, cpu, performance]
---

Quando um programa está mais lento do que deveria, medir é o primeiro passo antes de otimizar. No Linux, a ferramenta `perf` é uma das formas mais completas de obter dados de baixo nível sobre o que está acontecendo no processador: tempo de execução, comportamento do cache, e desvios de ramos. Este post apresenta uma introdução prática à coleta desses três tipos de métrica.

# O que é o perf

O `perf` é uma interface para os *Performance Monitoring Counters* (PMCs) presentes nos processadores modernos, além de outros recursos do kernel como *tracing*. Ele vem com o pacote `linux-tools` na maioria das distribuições:

```bash
# Debian/Ubuntu
sudo apt install linux-tools-common linux-tools-$(uname -r)

# Fedora
sudo dnf install perf
```

Ele depende de dois componentes principais:

- O *kernel* expõe os contadores via `perf_event_open`.
- O processador fornece registradores de hardware que contam eventos como ciclos, falhas de cache e branches.

Por isso, o que o `perf` mede é **real**, não estimado: são valores amostrados diretamente do hardware.

# Conceitos Fundamentais

- **Evento**: um acontecimento contado pelo processador. Exemplos: `cycles`, `instructions`, `cache-misses`, `branch-misses`.
- **Contador**: registrador de hardware que conta um evento específico. CPUs têm poucos contadores reais, então o `perf` multiplexa as contagens.
- **Amostragem**: o `perf` interrompe o programa periodicamente (por contagem de eventos ou por tempo) e registra onde a execução estava. Estatísticas são derivadas dessas amostras.

# Tempo de Execução: ciclos e instruções

A primeira pergunta costuma ser: *"Quanto tempo meu programa gasta em cada função?"*. Para isso usamos contadores básicos de CPU.

## Coletando com `perf stat`

```bash
perf stat ./meu_programa
```

Saída típica:

```
 Performance counter stats for './meu_programa':

         1.234.567.890      cycles
           987.654.321      instructions              #    0,80  insn per cycle
       5.123.456.789      task-clock
            23,45%        1,234                       #    0,123456 GHz
         1.234.567.890      cpu-clock

       0,123456789 seconds time elapsed
```

A métrica mais importante aqui é **IPC (Instructions Per Cycle)**. Um valor próximo de 4 indica boa exploração de *pipeline*; valores muito abaixo de 1 geralmente denunciam *stalls* frequentes (cache misses, por exemplo).

O *pipeline* é uma técnica pela qual a CPU decompõe a execução de uma instrução em estágios (*fetch*, *decode*, *execute*, *memory*, *writeback*) e processa várias instruções em paralelo nos estágios. O IPC mede quantas instruções a CPU termina por ciclo: quanto mais alto, mais o processador está ocupado. Valores muito abaixo de 1 indicam *stalls* — geralmente esperando memória.

## Perfilar por função com `perf record` + `perf report`

```bash
perf record -g ./meu_programa
perf report
```

O `-g` ativa amostragem baseada em *stack*, permitindo visualizar a *call graph*. Navegue com as setas: a porcentagem representa a fração de amostras em que cada função estava executando.

# Cache: medindo taxa de acerto e falha

Compreender o comportamento do cache geralmente revela gargalos invisíveis em um profile temporal. O `perf` pode contar eventos como `cache-misses`, `cache-references` e variações específicas de cache L1, L2, LLC.

## Visão geral do sistema

```bash
perf stat -e cache-references,cache-misses,instructions ./meu_programa
```

O resultado inclui a taxa de *miss* automaticamente:

```
   123.456.789      cache-references
    12.345.678      cache-misses              #    10,00% of all cache refs
 1.234.567.890      instructions
```

## Detalhando por nível de cache

O processador expõe eventos refinados por nível. Em processadores Intel:

```bash
perf stat -e \
  L1-dcache-load-misses,\
  L1-dcache-loads,\
  LLC-load-misses,\
  LLC-loads \
  ./meu_programa
```

Em processadores AMD a nomenclatura muda (eventos `amd_l3` / `pmc`). Para listar eventos disponíveis na sua CPU:

```bash
perf list | grep cache
```

# Desvios de Ramos (Branch Prediction)

*Branch prediction* errado custa caro: cada *miss* implica *flush* do pipeline e possíveis *stalls*. Para verificar:

```bash
perf stat -e branches,branch-misses,instructions ./meu_programa
```

```
 1.234.567.890      branches
    12.345.678      branch-misses            #    1,00% of all branches
 1.234.567.890      instructions
```

Taxas de *miss* abaixo de 1% são típicas de código bem organizado; valores muito acima disso sugerem ramificações imprevisíveis, comuns em laços com dados aleatórios, ordenações parcialmente ordenadas ou polimorfismo mal gerido pelo compilador.

Se quiser correlacionar *misses* com o código-fonte, use amostragem:

```bash
perf record -e branch-misses -g ./meu_programa
perf report
```

# Combinando tudo em uma única execução

Como o número de contadores físicos é pequeno, o `perf` multiplexa: ele rotaciona os eventos ao longo do tempo. Isso significa que rodar tudo em um único comando dá uma visão panorâmica eficiente.

## Sobre a multiplexação

CPUs modernas têm poucos **PMCs** (Performance Monitoring Counters) — tipicamente 4 a 8 por núcleo. Cada PMC conta **um único tipo de evento** por vez. Quando o `perf` precisa medir mais eventos do que cabem nos PMC's disponíveis, ele divide o tempo em janelas curtas e, em cada janela, programa os PMC's com um subconjunto diferente de eventos.

Por exemplo, se você pede 8 eventos e a CPU só tem 4 contadores, o `perf` alterna entre o evento A e o evento B a cada janela. Cada número é então uma **estimativa amostrada**, não uma contagem exata.

Implicações práticas:

- **Erro estatístico**: rode o programa mais de uma vez (`perf stat -r 5`) para suavizar o ruído.
- **Cobertura desigual**: a multiplexação reduz a precisão quando o número de eventos pedidos é muito maior que o de PMC's.
- **Eventos correlacionados** (como `cycles`/`instructions`) podem divergir em medições multiplexadas, embora o `perf` ajuste exibindo os campos `mtime_enabled` e `mtime_running` para diagnosticar isso.

Na prática, prefira **poucos eventos por execução** para reduzir a multiplexação. Se precisar de 12 eventos, rode dois `perf stat` separados em vez de um com 12.

```bash
perf stat -e \
  cycles,instructions,\
  cache-references,cache-misses,\
  branches,branch-misses \
  ./meu_programa
```

# Perfilar Regiões Específicas com `perf record -c`

Quando o trecho crítico é conhecido, é possível restringi-lo a funções ou intervalos com `--filter`. Exemplo, contando *cache misses* apenas em uma função chamada `processar`:

```bash
perf record -e cache-misses --filter 'processar*' -g ./meu_programa
perf report
```

Outra abordagem útil é usar *perfetto* ou *tracepoints* para delimitar janelas, mas a maneira mais simples em programas de linha de comando é medir o programa inteiro e depois isolar a região no relatório.

# Lendo o Relatório

Após `perf record`, o relatório pode ser navegado em TUI:

- `Children`/`Self`: tempo incluindo funções chamadas vs. apenas a função atual.
- `Overhead %`: fração de amostras.
- `Command`/`Symbol`/`Dso`: processo, símbolo e módulo (binário ou kernel).

Para saídas automatizadas:

```bash
perf report --stdio --sort=sym --no-children
```

# Dicas Práticas

- **Sempre compare com referência.** Otimize após medir e meça de novo; diferença dentro de ~3% costuma ser ruído.
- **Desative `cpu-frequency scaling` ou fixe a frequência** em testes reprodutíveis — variações de clock distorcem contagens de `cycles`.
- **Construa com `-fno-omit-frame-pointer`** para que o `perf` consiga resolver a *call stack* de forma confiável.
- **Prefira Linux nu para perfis de baixa granularidade.** Containers e VMs adicionam ruído, embora ainda funcionem.
- **Multiplique rodadas.** Coletar o programa repetidas vezes reduz variância estatística:

```bash
perf stat -r 5 ./meu_programa
```

# Resumindo

O `perf` cobre três frentes com profundidade:

| Pergunta                                | Comando |
|----------------------------------------|---------|
| Quais funções consomem mais tempo?      | `perf record -g && perf report` |
| Quais taxas de cache miss tenho?        | `perf stat -e cache-references,cache-misses` |
| Minha predição de ramos é eficiente?    | `perf stat -e branches,branch-misses` |
| Tudo junto de forma rápida?            | `perf stat -e cycles,instructions,cache-misses,branch-misses` |

A leitura desses três tipos de métrica em conjunto fornece um quadro claro de onde está o custo real do programa: se é largura de código baixa (*IPC* baixo), se é memória ruim (*cache misses* altos), ou se é fluxo de controle imprevisível (*branch misses* elevados). Cada uma dessas hipóteses guia um conjunto diferente de otimizações e merece ser testada com dados antes de ser aplicada.

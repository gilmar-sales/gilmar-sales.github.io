---
layout: post
title:  "Google Benchmark: Medindo Desempenho de Código C++ com Confiança"
date:   2026-09-27 10:00:00 -0300
author: Gilmar Sales
categories: cpp performance benchmarking
---

Otimizar código sem medir é adivinhar. E medir mal pode ser pior do que não medir: resultados ruidosos levam a conclusões erradas, que levam a refatorações desnecessárias, ou pior, a regressões que passam despercebidas. O Google Benchmark é uma biblioteca C++ que resolve exatamente esse problema: estrutura, controle e reprodutibilidade para microbenchmarks.

Este post cobre desde a configuração até práticas avançadas para obter números que você pode confiar de verdade.

---

# O que é o Google Benchmark

O [Google Benchmark](https://github.com/google/benchmark) é uma biblioteca open source mantida pelo Google para escrever *microbenchmarks* em C++. Ele cuida automaticamente de:

- **Aquecimento**: roda o benchmark por tempo suficiente antes de coletar dados, eliminando o viés do cold start.
- **Iterações adaptativas**: aumenta o número de iterações até que a medição fique estável, sem você precisar escolher um valor à mão.
- **Saída estruturada**: resultado em tabela legível por humanos e em JSON/CSV para análise automatizada.
- **Proteção contra eliminação pelo otimizador**: ferramentas como `DoNotOptimize` e `ClobberMemory` impedem que o compilador descarte código que ele detecta como "sem efeito colateral observável".

Ele não substitui profilers como `perf` ou VTune, eles atuam em níveis diferentes. O Google Benchmark mede *tempo de parede* com alta precisão em um loop controlado; profilers amostram o comportamento de um programa completo. Use os dois.

---

# Instalação

## Via vcpkg (recomendado em projetos CMake)

```bash
vcpkg install benchmark
```

## Via CMake FetchContent

```cmake
include(FetchContent)
FetchContent_Declare(
  benchmark
  GIT_REPOSITORY https://github.com/google/benchmark.git
  GIT_TAG        v1.9.1
)
set(BENCHMARK_ENABLE_TESTING OFF)
FetchContent_MakeAvailable(benchmark)

target_link_libraries(meu_benchmark PRIVATE benchmark::benchmark)
```

## Build manual

```bash
git clone https://github.com/google/benchmark.git
cmake -S benchmark -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DBENCHMARK_ENABLE_TESTING=OFF
cmake --build build
cmake --install build --prefix ~/.local
```

---

# Estrutura Básica de um Benchmark

```cpp
#include <benchmark/benchmark.h>
#include <vector>
#include <algorithm>

static void BM_sort_vector(benchmark::State& state) {
    std::vector<int> v(state.range(0));
    std::iota(v.begin(), v.end(), 0);

    for (auto _ : state) {
        std::shuffle(v.begin(), v.end(), std::mt19937{42});
        std::sort(v.begin(), v.end());
    }
}
BENCHMARK(BM_sort_vector)->Range(64, 1 << 16);

BENCHMARK_MAIN();
```

O loop `for (auto _ : state)` é o núcleo: o framework controla quantas vezes ele executa e registra os tempos. `state.range(0)` passa um parâmetro, neste caso, o tamanho do vetor.

---

# Compilação

Compile **sempre** em Release com otimizações ativadas:

```bash
cmake -DCMAKE_BUILD_TYPE=Release ..
```

Benchmarks compilados em Debug são inúteis para análise de desempenho real. O compilador inlina, vectoriza e elimina código morto em Release de um jeito completamente diferente.

Se você usa GCC ou Clang diretamente:

```bash
g++ -O3 -DNDEBUG -march=native bench.cpp -lbenchmark -lpthread -o bench
```

`-march=native` autoriza o compilador a usar todas as instruções da máquina local (AVX2, por exemplo). **Cuidado**: binários compilados com `-march=native` podem não rodar em máquinas mais antigas.

---

# Proteção contra o Otimizador

O maior inimigo do microbenchmark é o compilador. Ele pode perceber que um resultado nunca é usado e eliminar completamente o código que você quer medir.

## `DoNotOptimize`

```cpp
static void BM_soma(benchmark::State& state) {
    for (auto _ : state) {
        int soma = 0;
        for (int i = 0; i < 1000; ++i) soma += i;
        benchmark::DoNotOptimize(soma);  // impede eliminação
    }
}
```

`DoNotOptimize(x)` força `x` a existir em memória ou em um registrador real, o compilador não pode provar que ninguém vai ler o valor e, portanto, não pode eliminar a computação.

## `ClobberMemory`

```cpp
static void BM_fill(benchmark::State& state) {
    std::vector<int> v(1024);
    for (auto _ : state) {
        std::fill(v.begin(), v.end(), 0);
        benchmark::ClobberMemory();  // força escrita em memória
    }
}
```

`ClobberMemory` emite uma barreira de memória: diz ao compilador que qualquer escrita pendente deve ser efetivada, porque "algo externo" pode lê-la. Útil quando o resultado está em uma estrutura de dados em memória, não em uma variável escalar.

**Regra geral**: use `DoNotOptimize` no valor de saída de qualquer computação que você quer medir. Se a computação escreve em memória (vetor, buffer), use `ClobberMemory` depois.

---

# Parametrização

## Faixa de valores

```cpp
BENCHMARK(BM_sort_vector)->Range(8, 8 << 10);
// testa: 8, 64, 512, 4096, 8192
```

## Valores explícitos

```cpp
BENCHMARK(BM_lookup)->Arg(100)->Arg(1000)->Arg(10000);
```

## Múltiplos parâmetros

```cpp
static void BM_matrix_mul(benchmark::State& state) {
    int rows = state.range(0);
    int cols = state.range(1);
    // ...
}
BENCHMARK(BM_matrix_mul)
    ->Args({128, 128})
    ->Args({256, 256})
    ->Args({512, 512});
```

## Produto cartesiano

{% raw %}
```cpp
BENCHMARK(BM_algo)
    ->ArgsProduct({{64, 256, 1024}, {1, 4, 16}});
// 9 combinações: (64,1), (64,4), ..., (1024,16)
```
{% endraw %}

---

# Fixtures: Setup e Teardown

Quando a preparação do dado é cara, alocar memória grande, carregar arquivo, construir estrutura complexa, use fixtures para não incluir esse custo na medição:

```cpp
class SortFixture : public benchmark::Fixture {
public:
    void SetUp(const benchmark::State& state) override {
        data.resize(state.range(0));
        std::iota(data.begin(), data.end(), 0);
    }

    std::vector<int> data;
};

BENCHMARK_DEFINE_F(SortFixture, Sort)(benchmark::State& state) {
    for (auto _ : state) {
        std::vector<int> copy = data;          // cópia é cara: pausa o timer
        state.PauseTiming();
        std::shuffle(copy.begin(), copy.end(), std::mt19937{42});
        state.ResumeTiming();
        std::sort(copy.begin(), copy.end());
        benchmark::DoNotOptimize(copy.data());
    }
}
BENCHMARK_REGISTER_F(SortFixture, Sort)->Range(64, 1 << 14);
```

`PauseTiming` / `ResumeTiming` excluem custo de setup por iteração do resultado final. Use com parcimônia: cada chamada tem overhead.

---

# Métricas Personalizadas

## Vazão (throughput)

```cpp
static void BM_memcpy(benchmark::State& state) {
    std::vector<char> src(state.range(0), 'a');
    std::vector<char> dst(state.range(0));

    for (auto _ : state) {
        std::memcpy(dst.data(), src.data(), src.size());
        benchmark::ClobberMemory();
    }

    state.SetBytesProcessed(
        static_cast<int64_t>(state.iterations()) * state.range(0)
    );
}
BENCHMARK(BM_memcpy)->Range(1 << 10, 1 << 26);
```

Com `SetBytesProcessed`, o framework calcula e exibe automaticamente `bytes/s` muito mais útil que nanosegundos brutos para operações de memória.

## Contador personalizado

```cpp
state.counters["elementos/s"] = benchmark::Counter(
    state.iterations() * N,
    benchmark::Counter::kIsRate
);
```

`kIsRate` divide o valor total pelo tempo, resultando em "por segundo".

---

# Controle de Tempo e Iterações

Por padrão o framework roda cada benchmark por pelo menos 0,5 segundo. Você pode ajustar:

```cpp
BENCHMARK(BM_algo)->MinTime(2.0);           // mínimo 2 segundos
BENCHMARK(BM_algo)->Iterations(100000);     // exatamente 100k iterações
BENCHMARK(BM_algo)->MinWarmUpTime(1.0);     // 1s de aquecimento
```

`MinTime` é geralmente preferível a `Iterations` porque adapta ao hardware: em uma máquina lenta, mais iterações rodam para atingir o tempo mínimo, produzindo médias mais estáveis.

---

# Reduzindo Variância: o coração das boas práticas

Um benchmark que dá resultados diferentes toda vez que você roda é inútil. Abaixo estão as causas mais comuns de variância e como mitigá-las.

## 1. CPU Frequency Scaling

Processadores modernos variam sua frequência dinamicamente (SpeedStep, Boost, P-states). Um benchmark pode pegar o processador em qualquer frequência, produzindo números inconsistentes.

**Solução no Linux**:
```bash
# Fixar no governor de performance
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo performance | sudo tee $cpu
done
```

Ou usando `cpupower`:
```bash
sudo cpupower frequency-set -g performance
```

O Google Benchmark detecta escalonamento e avisa:
```
***WARNING*** CPU scaling is enabled, the benchmark real time measurements
may be noisy and will incur extra overhead.
```

Não ignore esse aviso.

## 2. Turbo Boost

O Turbo Boost sobe a frequência além do nominal por curtos períodos. Para benchmarks curtos isso infla artificialmente o resultado.

```bash
# Intel: desabilitar via MSR
echo 1 | sudo tee /sys/devices/system/cpu/intel_pstate/no_turbo

# AMD
echo 0 | sudo tee /sys/devices/system/cpu/cpufreq/boost
```

## 3. Isolamento de CPU (CPU Pinning)

O kernel pode migrar seu processo entre núcleos durante a execução, causando invalidação de cache e latência de NUMA.

```bash
# Rodar o benchmark no núcleo 2, isolado
taskset -c 2 ./meu_benchmark
```

Para isolar permanentemente um núcleo do scheduler (nível de produção):

```
# /etc/default/grub
GRUB_CMDLINE_LINUX="isolcpus=2,3 nohz_full=2,3 rcu_nocbs=2,3"
```

## 4. NUMA

Em sistemas multi-socket, acessar memória alocada em outro nó (NUMA node) pode ser 2-4x mais lento. Garanta que benchmark e memória rodem no mesmo nó:

```bash
numactl --cpunodebind=0 --membind=0 ./meu_benchmark
```

## 5. Variância Térmica

O processador reduz frequência quando aquece (*thermal throttling*). Benchmarks longos em sequência podem pegar estados térmicos diferentes.

Monitore:
```bash
watch -n 1 'cat /sys/class/thermal/thermal_zone*/temp'
```

Se a temperatura sobe progressivamente durante a suite, adicione pausas entre benchmarks ou use `--benchmark_min_warmup_time` para estabilizar antes de medir.

## 6. Hyper-Threading

Dois threads no mesmo núcleo físico compartilham recursos de execução. Um benchmark no thread 0 pode ser afetado pelo sistema operacional rodando tarefas no thread 1 (mesmo núcleo físico).

Desabilitar HT garante que o núcleo físico seja exclusivo:
```bash
echo off | sudo tee /sys/devices/system/cpu/smt/control
```

## 7. ASLR (Address Space Layout Randomization)

O ASLR randomiza endereços de memória a cada execução. Isso muda o alinhamento de funções e dados, causando diferenças de performance por puro acaso.

```bash
setarch $(uname -m) --addr-no-randomize ./meu_benchmark
```

---

# Interpretando a Saída

```
Benchmark                      Time          CPU    Iterations
--------------------------------------------------------------
BM_sort_vector/64            1823 ns       1820 ns      383482
BM_sort_vector/512           18235 ns     18210 ns       38412
BM_sort_vector/4096         210453 ns    210100 ns        3324
BM_sort_vector/32768       2435120 ns   2430000 ns         289
```

- **Time**: tempo de parede (*wall clock*). Inclui trocas de contexto, interrupções e outros processos.
- **CPU**: tempo consumido pelo seu processo na CPU. Costuma ser mais estável que *Time* em sistemas com carga.
- **Iterations**: quantas vezes o loop interno rodou. Números muito baixos (< 100) indicam benchmark muito lento, considere usar `Iterations()` explícito.

Para análise estatística detalhada:

```bash
./meu_benchmark --benchmark_repetitions=10 --benchmark_report_aggregates_only=false
```

Isso roda cada benchmark 10 vezes e reporta `mean`, `median`, `stddev` e `cv` (coeficiente de variação). Se o `cv` estiver acima de 5%, há variância significativa, investigue as causas acima.

---

# Saída em JSON para Análise Comparativa

```bash
./bench_v1 --benchmark_out=v1.json --benchmark_out_format=json
./bench_v2 --benchmark_out=v2.json --benchmark_out_format=json
```

O Google Benchmark inclui uma ferramenta de comparação:

```bash
python3 tools/compare.py benchmarks v1.json v2.json
```

Saída:
```
Comparing v1.json to v2.json
Benchmark                    Time        CPU      Time Old  Time New  CPU Old  CPU New
BM_sort_vector/64           -0.1234   -0.1230        1823      1598      1820     1596
```

Use isso em CI para detectar regressões automaticamente. O script retorna código de erro se a degradação ultrapassar um limiar configurável.

---

# Boas Práticas: Checklist

**Setup do ambiente**
- [ ] CPU governor fixado em `performance`
- [ ] Turbo Boost desabilitado
- [ ] Processo isolado em núcleo específico (`taskset` ou `isolcpus`)
- [ ] NUMA controlado (`numactl`) em sistemas multi-socket
- [ ] ASLR desabilitado para benchmarks de baixa variância

**Escrita do benchmark**
- [ ] Compilado com `-O3 -DNDEBUG` (Release)
- [ ] `DoNotOptimize` em todo resultado de computação
- [ ] `ClobberMemory` em escritas em buffers/vetores
- [ ] Setup caro feito fora do loop ou com `PauseTiming`
- [ ] `SetBytesProcessed` ou contador customizado para operações de I/O ou bulk

**Coleta e análise**
- [ ] `--benchmark_repetitions=10` (ou mais) para estatísticas
- [ ] Verificar `cv` (coeficiente de variação) < 5%
- [ ] Salvar resultados em JSON para comparação histórica
- [ ] Rodar em hardware dedicado (não em CI compartilhado) para números absolutos confiáveis
- [ ] Comparar sempre relativo (A vs B), não absoluto (X ns), para mitigar variação entre máquinas

---

# Comparação com Alternativas

| Biblioteca       | Linguagem | Aquecimento automático | Parametrização | Saída JSON |
|:-----------------|:----------|:----------------------:|:--------------:|:----------:|
| Google Benchmark | C++       | ✓                      | ✓              | ✓          |
| Catch2 (microbench) | C++    | parcial                | manual         | ✗          |
| Celero           | C++       | ✓                      | ✓              | ✗          |
| nanobench        | C++       | ✓                      | manual         | ✓          |
| Criterion        | Rust      | ✓                      | ✓              | ✓          |

Para projetos C++ novos, Google Benchmark é a escolha padrão pela maturidade, documentação e integração com ferramentas de comparação.

---

# Exemplo Completo: Comparando Estratégias de Lookup

```cpp
#include <benchmark/benchmark.h>
#include <unordered_map>
#include <map>
#include <vector>
#include <algorithm>

static std::vector<int> make_keys(int n) {
    std::vector<int> v(n);
    std::iota(v.begin(), v.end(), 0);
    return v;
}

static void BM_unordered_map_lookup(benchmark::State& state) {
    auto keys = make_keys(state.range(0));
    std::unordered_map<int,int> m;
    for (auto k : keys) m[k] = k * 2;

    for (auto _ : state) {
        for (auto k : keys) {
            auto it = m.find(k);
            benchmark::DoNotOptimize(it);
        }
    }
    state.SetItemsProcessed(state.iterations() * state.range(0));
}

static void BM_sorted_vector_lookup(benchmark::State& state) {
    auto keys = make_keys(state.range(0));
    std::vector<std::pair<int,int>> v;
    v.reserve(keys.size());
    for (auto k : keys) v.emplace_back(k, k * 2);
    std::sort(v.begin(), v.end());

    for (auto _ : state) {
        for (auto k : keys) {
            auto it = std::lower_bound(v.begin(), v.end(),
                                       std::make_pair(k, 0));
            benchmark::DoNotOptimize(it);
        }
    }
    state.SetItemsProcessed(state.iterations() * state.range(0));
}

BENCHMARK(BM_unordered_map_lookup)->Range(16, 1 << 14);
BENCHMARK(BM_sorted_vector_lookup)->Range(16, 1 << 14);

BENCHMARK_MAIN();
```

Com `-march=native` e as otimizações de ambiente descritas, esse benchmark mostrará de forma confiável o cruzamento entre as duas estruturas: abaixo de um certo tamanho, o `std::vector` ordenado ganha por localidade de cache; acima, o `unordered_map` vence pela complexidade O(1) do hash.

---

Microbenchmarks bem escritos são documentação executável do desempenho do seu código. Quando combinados com controle de ambiente e análise estatística, eles deixam de ser ruído e passam a ser sinal confiável, a base para otimizações que realmente importam.

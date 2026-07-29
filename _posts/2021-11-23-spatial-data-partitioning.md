---
layout: post
title:  "Particionamento Espacial de Dados"
date:   2021-11-22 09:53:10 -0300
author: Gilmar Sales
categories: computer-graphics computer-science
tags: [quadtree, particionamento, simulação, open-gl, cpp]
---

Estruturas de particionamento espacial são técnicas usadas para organizar objetos no espaço 2D (ou 3D), com o objetivo de tornar buscas, renderizações e detecções de colisão muito mais rápidas. Uma das estruturas mais conhecidas para esse fim é a **QuadTree**.

Os exemplos e comparações de desempenho apresentados neste post foram retirados do repositório [gilmar-sales/spatial-data-partitioning](https://github.com/gilmar-sales/spatial-data-partitioning), que contém uma implementação completa em C++/OpenGL com análise comparativa.

## QuadTree

A QuadTree é uma estrutura de dados para armazenar **pontos** em um plano bidimensional de forma eficiente. Ela funciona como uma árvore binária, mas em vez de duas partições (esquerda e direita), organiza os dados em **quatro** partições: superior-esquerda, superior-direita, inferior-esquerda e inferior-direita.

<div align="center">
  <img src="/images/spatial-partitioning/quadtree_diagram.png" alt="Partículas organizadas em uma QuadTree" width="500"/>
</div>

### Passos de construção

1. Divide o plano em quatro caixas (partições).
2. Verifica se o ponto está dentro da partição; se sim, insere.
3. Se a partição ainda não contém pontos, insere o ponto.
4. Se a partição contém mais pontos do que a capacidade definida, cria quatro partições filhas dentro dela.
5. Repete recursivamente todos os passos para cada partição filha, até que o ponto seja inserido.

### Passos de busca

1. Verifica se a partição **contém** o ponto buscado.
2. Se nenhuma das partições filhas contém o ponto, retorna os pontos presentes na partição atual.
3. Caso contrário, percorre recursivamente as partições filhas, escolhendo aquela na qual o ponto se encontra (esquerda/direita e cima/baixo).

## Exemplo: simulação de partículas 2D

O repositório implementa uma simulação de partículas com colisão, comparando três abordagens: força bruta, QuadTree e QuadTree com multi-threading.

### O problema

Imagine que existam **n** partículas em uma área do plano. Como verificar se cada partícula está colidindo com todas as outras?

### Método por iteração (força bruta)

1. Para cada ponto, itera sobre os demais.
2. Verifica se há colisão comparando par a par.

```cpp
for(int i = 0; i < n; i++) {
    for(int j = 0; j < n; j++) {
        if(particles[i].intersect(particles[j]))
            // está colidindo
    }
}
```

Essa abordagem tem complexidade **O(n²)**.

<div align="center">
  <img src="/images/spatial-partitioning/greedy.png" alt="Simulação por força bruta" width="500"/>
</div>

### Otimização com QuadTree

1. Adiciona cada ponto em uma QuadTree.
2. Para cada ponto, consulta a árvore em busca de possíveis colisões.
3. Verifica a colisão apenas com os pontos encontrados.

**Vantagem:** como a QuadTree organiza os dados por partições, basta testar a interseção entre a partícula e os **limites** de uma partição para descartar, em um único passo, todas as partículas contidas nela. Como cada partição é independente, ela pode ser processada em uma thread separada, viabilizando uma paralelização trivial.

```cpp
QuadTree tree = QuadTree();

for(int i = 0; i < N; i++) {
    tree.insert(particles[i]);
}

for(int i = 0; i < N; i++) {
    std::vector<Particle*> found = tree.search(particles[i]);

    for(Particle* other : found) {
        if(particles[i].intersect(other))
            // está colidindo
    }
}
```

Essa abordagem tem complexidade **O(n log(n))**.

<div align="center">
  <img src="/images/spatial-partitioning/quadtree.png" alt="Simulação por força bruta" width="500"/>
</div>


<div align="center">
  <img src="/images/spatial-partitioning/grafico.svg" alt="Gráfico de comparação completo" width="500"/>
</div>

### Comparação de desempenho

Os gráficos abaixo foram gerados a partir de medições reais realizadas no repositório.

Para uma quantidade pequena de partículas, o custo de construir e manter a QuadTree não compensa — a iteração direta acaba sendo mais rápida.

<div align="center">
  <img src="/images/spatial-partitioning/grafico_focado.svg" alt="Gráfico de comparação focado" width="500"/>
</div>

Porém, conforme o número de partículas cresce, a otimização com QuadTree se torna **9 a 10 vezes** mais rápida que o método por iteração.

## Implementação de referência

A implementação completa em C++ pode ser encontrada em [gilmar-sales/spatial-data-partitioning](https://github.com/gilmar-sales/spatial-data-partitioning). A estrutura principal da `QuadTree` é definida em [`quadtree.h`](https://github.com/gilmar-sales/spatial-data-partitioning/blob/main/quadtree/src/core/quadtree.h):

```cpp
class QuadTree {
public:
    QuadTree(glm::vec2 position, float half_range, unsigned capacity);
    ~QuadTree() = default;

    bool insert(Particle* particle);
    void subdivide();
    void query(Particle* particle, std::vector<Particle*>* found);
    bool contains(Particle* particle);
    bool intersect(Particle* particle);
    void draw(unsigned vao, unsigned shaderProgram);

private:
    glm::vec2 m_position;
    float m_half_range;
    std::vector<Particle*> m_elements;
    unsigned m_capacity;
    unsigned m_count = 0;

    std::unique_ptr<QuadTree> m_top_left;
    std::unique_ptr<QuadTree> m_top_right;
    std::unique_ptr<QuadTree> m_bot_left;
    std::unique_ptr<QuadTree> m_bot_right;
};
```

A operação de `insert` percorre recursivamente as partições, subdividindo o nó quando a capacidade é atingida:

```cpp
bool QuadTree::insert(Particle* element)
{
    if (!contains(element))
    {
        return false;
    }

    if (m_count < m_capacity)
    {
        m_elements[m_count++] = element;
        return true;
    } else if (m_top_left == nullptr) {
        subdivide();
    }

    return (
        m_top_left->insert(element) ||
        m_top_right->insert(element) ||
        m_bot_left->insert(element) ||
        m_bot_right->insert(element)
    );
}
```

A consulta por região (`query`) descarta subárvores que não intersectam a partícula e apenas desce nas que podem conter candidatos à colisão:

```cpp
void QuadTree::query(Particle* particle, std::vector<Particle*>* found)
{
    if (!intersect(particle))
    {
        return;
    }

    for (unsigned i = 0; i < m_count; i++)
    {
        if(particle == m_elements[i])
            continue;

        if (contains(m_elements[i]))
        {
            found->push_back(m_elements[i]);
        }
    }

    if (m_top_left)
    {
        m_top_left->query(particle, found);
        m_top_right->query(particle, found);
        m_bot_left->query(particle, found);
        m_bot_right->query(particle, found);
    }
}
```

## Versão com multi-threading

O repositório também traz uma versão paralela ([`collisions_quadtree_threads.cpp`](https://github.com/gilmar-sales/spatial-data-partitioning/blob/main/quadtree/src/collisions_quadtree_threads.cpp)) que distribui a atualização de física entre `std::thread::hardware_concurrency()` threads, cada uma responsável por uma fatia do array de partículas:

```cpp
unsigned thread_count = std::thread::hardware_concurrency();
auto threads = std::vector<std::thread>();
threads.reserve(thread_count);

unsigned thread_load = particles_count / thread_count;

for (unsigned i = 0; i < thread_count; i++) {
    threads.emplace_back(std::thread(update_physics,
                             &particles[thread_load*i],
                             quad_tree,
                             thread_load,
                             Application::delta_time));
}

for (unsigned i = 0; i < thread_count; i++) {
    threads[i].join();
}
```

A otimização do algoritmo está em evitar verificações de colisão entre partículas que estão em regiões distantes do espaço, descartando rapidamente regiões inteiras que não podem colidir, em vez de comparar todas as partículas entre si como faria a abordagem ingênua O(n²).

## Repositório

Todo o código e os scripts de geração dos gráficos estão disponíveis em:

- [github.com/gilmar-sales/spatial-data-partitioning](https://github.com/gilmar-sales/spatial-data-partitioning)

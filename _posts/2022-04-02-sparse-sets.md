---
layout: post
title:  "Sparse Sets - Uma Representação Eficiente de Conjuntos Numéricos"
date:   2022-04-03 14:30:10 -0300
author: Gilmar Sales
categories: estrutura-de-dados 
---

# Conjuntos
**Conjunto Numérico** é uma abstração fundamental bastante utilizada na programação, várias representações são possíveis, cada uma com suas vantagens e desvantagens. Existem duas principais representações amplamente utilizadas: **Árvores Binárias** e **Tabelas Hash**
## Representações mais comuns
### Árvores Binárias de Busca
Esta representação se aproveita da habilidade de inserir elementos ordenados e rotacionar a árvores para mantêlá balanceada para representação conjuntos, e é vantajosa quando o conjunto precisa sempre estar ordenado e possuir muitos elementos.
### Tabelas Hash
Esta representação ganha destaque pelo desempenho superior ao das árvores binárias enquanto existirem poucos elementos e por consequência poucas colisões, porém a ordem não pode ser obrigatória.
### Tabela de Complexidade Assintótica

Operação   |Árvore Binária |Tabela Hash    
---------- | ------------- | -----------
Inserir    |O(lg⁡(n))       |o(1); O(n)             
Remover    |O(lg⁡(n))       |o(1); O(n)             
Pesquisar  |O(lg⁡(n))       |o(1); O(n)             
Limpar     |O(lg⁡(n))       |o(1); O(n)           
Iterar     |O(n)           |O(n)                 
Espaço     |O(n)           |O(n)           

# Sparse Sets

{% katexmm %}
**Sparse Set** é uma estrutura de dados simples e muito eficiente que garante um conjunto de números únicos, porém não ordenados. Sua implementação é formada por dois arranjos de números, um esparso ($S$) e outro denso ($D$), sendo $|S| + 1$ o valor máximo que pode ser inserido no conjunto, e para que um elemento n exista no conjunto esparso, as seguintes restrições devem ser atendidas:
{% endkatexmm %}

## Restrições

### Quantidade
{% katexmm %}
A quantidade máxima de números que podem ser adicionados é igual ao maior número que será inserido mais 1:
$$0 < S[n] < |S|$$
{% endkatexmm %}

### Índice
{% katexmm %}
O índice $n$ do conjunto esparso aponta para o índice do número $n$ no conjunto denso:
$$D[S[n]] == n$$
{% endkatexmm %}

Ex: {5, 1, 4}

<center>
<img src="images/sparse-sets.png" />
</center>

## Vantagens

### Complexidade Assintótica Superior

Operação   |Árvore Binária |Tabela Hash | Sparse Set
---------- | ------------- | ---------- | -----------
Inserir    |O(lg⁡(n))       |o(1); O(n)  |O(1)
Remover    |O(lg⁡(n))       |o(1); O(n)  |O(1)           
Pesquisar  |O(lg⁡(n))       |o(1); O(n)  |O(1)       
Limpar     |O(lg⁡(n))       |o(1); O(n)  |O(1)     
Iterar     |O(n)           |O(n)        |O(n)    
Espaço     |O(n)           |O(n)        |O(n)

### Layout de memória

Os números que pertencem ao conjunto são organizados **contiguamente** no arranjo denso, dando uma vantagem enorme nas operações de inserir, remover, pesquisar e iteração por ter um layout de memória amigável ao cache do processador. Vale lembrar que operações de união, intersecção e diferença são exemplos extremamente relevantes de operações que são implementadas com as operações de inserir, remover, pesquisar e iterar.
## Desvantagens
### Quantidade finita
As outras representações de conjuntos não possuem a limitação de quantidade existente na definição da estrutura do sparse set, porém ainda são limitadas pelos limites de hardware.
### Números negativos 
Pela definição da implementação do sparse set ser relativo aos índices, os números negativos não podem ser adicionados nesses conjuntos a menos que: seja delimitado o menor e maior número que pode ser adicionado e com base nisso, os números sejam convertidos para os seus respectivos índices, por exemplo:

<center>
<p>Menor: -10, Maior: 100</p>
</center>

índice|0   |1  |2  |...|10 |...|109
:-----|:--:|:-:|:-:|:-:|:-:|:-:|:--:
valor |-10 | -9| -8|...| 0 |...|100 

## Glossário

### Contiguamente
De modo contíguo, vizinho, próximo, um ao lado do outro.

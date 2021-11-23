---
layout: post
title:  "Particionamento Espacial de Dados"
date:   2021-11-22 09:53:10 -0300
author: Gilmar Sales
categories: computer-graphics computer-science
---

```cpp
#include <iostream>

using namespace std;

/*
 * oaskdoaskd
 */

 class Application
 {
public:
    Application(string name) : m_name(name) {}
    ~Application() = default;

    string get_name() { return m_name; }
private:
    string m_name;
 }

// main function to initialize the application
int main(int argc, char** argv)
{
    Application app = new Application("hello");

    cout << "hello world" << endl;

    return 0;
}
```

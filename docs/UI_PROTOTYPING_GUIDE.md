# 🎨 Guia de Prototipagem UI - ZenithSolutions

Este guia ajuda você a prototipar interfaces rapidamente usando HTML/CSS/JS e migrar facilmente para o projeto React.

---

## 📋 Índice

1. [Como Usar o Template](#como-usar-o-template)
2. [Paleta de Cores](#paleta-de-cores)
3. [Componentes Disponíveis](#componentes-disponíveis)
4. [Migração para React](#migração-para-react)
5. [Prompt para IAs](#prompt-para-ias)
6. [Exemplos Práticos](#exemplos-práticos)

---

## 🚀 Como Usar o Template

### 1. Arquivo Base

Use o arquivo `UI_PROTOTYPE_TEMPLATE.html` como ponto de partida. Ele contém:

- ✅ Todas as variáveis CSS do projeto
- ✅ Componentes prontos para usar
- ✅ Tema claro/escuro
- ✅ JavaScript básico para interatividade

### 2. Abrir e Testar

```bash
# Simplesmente abra o arquivo no navegador
# Não precisa de servidor, funciona standalone
```

### 3. Modificar

- Copie seções do template
- Adicione seu conteúdo
- Teste no navegador
- Compartilhe com IAs para refinamento

---

## 🎨 Paleta de Cores

### Cores Primárias

```css
--ui-accent: #5a6570; /* Cinza principal */
--ui-accent-hover: #4a5560; /* Cinza hover */
--ui-accent-active: #3a4550; /* Cinza ativo */
```

> **Nota:** No tema claro, usamos cinza. O azul claro (#8ec8ee) é usado apenas no **tema escuro** para `--ui-accent`, mantendo o visual azul petróleo característico.

### Backgrounds (Tema Claro)

```css
--ui-bg: #ffffff; /* Fundo principal */
--ui-bg-secondary: #f8f9fa; /* Fundo secundário */
--ui-bg-tertiary: #f0f2f5; /* Fundo terciário */
--ui-card-bg: #ffffff; /* Fundo de cards */
--ui-input-bg: #ffffff; /* Fundo de inputs */
--ui-toolbar-bg: #f0f0f0; /* Fundo de toolbars */
```

### Backgrounds (Tema Escuro)

```css
--ui-bg: #1e2a35; /* Fundo principal */
--ui-bg-secondary: #263545; /* Fundo secundário */
--ui-bg-tertiary: #2d3e50; /* Fundo terciário */
--ui-card-bg: #2d3e50; /* Fundo de cards */
--ui-input-bg: #1e2a35; /* Fundo de inputs */
```

### Cores de Destaque (Tema Escuro)

```css
--ui-accent: #8ec8ee; /* Azul claro */
--ui-accent-hover: #a8d8f4; /* Azul mais claro */
--ui-accent-active: #70b8e6; /* Azul médio */
```

### Textos

```css
--ui-text: #2d2d2d; /* Texto principal (claro) */
--ui-text: #e8ebed; /* Texto principal (escuro) */
--ui-text-secondary: #4a4a4a; /* Texto secundário */
--ui-text-muted: #6a6a6a; /* Texto esmaecido */
--ui-text-disabled: #aaaaaa; /* Texto desabilitado */
```

### Bordas

```css
--ui-border: #e0e0e0; /* Borda padrão (claro) */
--ui-border: #3a4a5a; /* Borda padrão (escuro) */
--ui-border-light: #f0f0f0; /* Borda clara */
```

### Estados

```css
--ui-success: #28a745; /* Verde - sucesso */
--ui-warning: #ffc107; /* Amarelo - aviso */
--ui-error: #dc3545; /* Vermelho - erro */
--ui-info: #17a2b8; /* Azul claro - info */
```

### Espaçamentos

```css
--ui-spacing-xs: 4px;
--ui-spacing-sm: 8px;
--ui-spacing-md: 16px;
--ui-spacing-lg: 24px;
--ui-spacing-xl: 32px;
```

### Border Radius

```css
--ui-radius-sm: 4px;
--ui-radius-md: 6px;
--ui-radius-lg: 8px;
--ui-radius-xl: 12px;
--ui-radius-full: 9999px;
```

### Tipografia

```css
--ui-font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
--ui-font-size-xs: 11px;
--ui-font-size-sm: 12px;
--ui-font-size-md: 14px;
--ui-font-size-lg: 16px;
--ui-font-size-xl: 20px;
```

---

## 🧩 Componentes Disponíveis

### 1. Input de Texto

```html
<div class="ui-form-group">
  <label class="ui-label">Nome do Campo</label>
  <input type="text" class="ui-input" placeholder="Digite..." />
</div>
```

### 2. Input com Unidade

```html
<div class="ui-form-group">
  <label class="ui-label">Comprimento</label>
  <div class="ui-input-wrapper">
    <input type="number" value="10.5" />
    <span class="ui-input-unit">m</span>
  </div>
</div>
```

### 3. Select (Dropdown)

```html
<div class="ui-form-group">
  <label class="ui-label">Categoria</label>
  <select class="ui-select">
    <option>Selecione...</option>
    <option>Opção 1</option>
    <option>Opção 2</option>
  </select>
</div>
```

### 4. Textarea

```html
<div class="ui-form-group">
  <label class="ui-label">Descrição</label>
  <textarea class="ui-input" rows="3" placeholder="Digite..."></textarea>
</div>
```

### 5. Botões

```html
<!-- Primário -->
<button class="ui-btn">Botão Primário</button>

<!-- Secundário -->
<button class="ui-btn ui-btn-secondary">Botão Secundário</button>

<!-- Sucesso -->
<button class="ui-btn ui-btn-success">Sucesso</button>

<!-- Erro -->
<button class="ui-btn ui-btn-error">Erro</button>
```

### 6. Checkbox

```html
<div class="ui-checkbox-group">
  <input type="checkbox" id="check1" checked />
  <label for="check1">Opção habilitada</label>
</div>
```

### 7. Slider

```html
<div class="ui-slider-group">
  <label class="ui-label">Posição X: <span id="value">0</span>m</label>
  <input
    type="range"
    class="ui-slider"
    min="-50"
    max="50"
    value="0"
    oninput="document.getElementById('value').textContent = this.value"
  />
</div>
```

### 8. Card

```html
<div class="ui-card">
  <h3>Título do Card</h3>
  <p>Conteúdo do card...</p>
</div>
```

### 9. Section

```html
<div class="ui-section">
  <h2 class="ui-section-title">Título da Seção</h2>
  <!-- Conteúdo -->
</div>
```

### 10. Lista

```html
<div class="ui-list">
  <div class="ui-list-item">Item 1</div>
  <div class="ui-list-item selected">Item 2</div>
  <div class="ui-list-item">Item 3</div>
</div>
```

### 11. Badge

```html
<span class="ui-badge">Badge Normal</span>
<span class="ui-badge-success">Sucesso</span>
<span class="ui-badge-error">Erro</span>
```

### 12. Modal

```html
<div class="ui-modal-backdrop" style="display: none;" id="myModal">
  <div class="ui-modal" onclick="event.stopPropagation()">
    <div class="ui-modal-header">
      <h2 class="ui-modal-title">Título</h2>
      <button class="ui-modal-close" onclick="closeModal()">&times;</button>
    </div>

    <div>
      <!-- Conteúdo do modal -->
    </div>

    <div
      style="display: flex; gap: var(--ui-spacing-sm); justify-content: flex-end;"
    >
      <button class="ui-btn-secondary ui-btn">Cancelar</button>
      <button class="ui-btn">Confirmar</button>
    </div>
  </div>
</div>

<script>
  function closeModal() {
    document.getElementById("myModal").style.display = "none";
  }
</script>
```

### 13. Toolbar

```html
<div class="ui-toolbar">
  <button class="ui-btn-secondary ui-btn">Ação 1</button>
  <button class="ui-btn-secondary ui-btn">Ação 2</button>
  <div style="flex: 1;"></div>
  <button class="ui-btn">Ação Principal</button>
</div>
```

### 14. Form Row (Grid)

```html
<div class="ui-form-row">
  <div class="ui-form-group">
    <label class="ui-label">Campo 1</label>
    <input type="text" class="ui-input" />
  </div>
  <div class="ui-form-group">
    <label class="ui-label">Campo 2</label>
    <input type="text" class="ui-input" />
  </div>
  <div class="ui-form-group">
    <label class="ui-label">Campo 3</label>
    <input type="text" class="ui-input" />
  </div>
</div>
```

---

## 🔄 Migração para React

### 1. HTML → JSX

**HTML:**

```html
<div class="ui-card">
  <h3>Título</h3>
  <p>Conteúdo</p>
</div>
```

**JSX:**

```tsx
<div className="ui-card">
  <h3>Título</h3>
  <p>Conteúdo</p>
</div>
```

### 2. CSS Inline → Módulo CSS

**HTML:**

```html
<style>
  .ui-card {
    background: var(--ui-card-bg);
  }
</style>
```

**React:**

```tsx
// MyComponent.tsx
import "./MyComponent.css";

export function MyComponent() {
  return <div className="ui-card">...</div>;
}
```

```css
/* MyComponent.css */
@import "../styles/global-theme.css";

.ui-card {
  background: var(--ui-card-bg);
}
```

### 3. JavaScript → React Hooks

**HTML:**

```html
<button onclick="handleClick()">Clique</button>
<script>
  function handleClick() {
    alert("Clicado!");
  }
</script>
```

**React:**

```tsx
export function MyComponent() {
  const handleClick = () => {
    alert("Clicado!");
  };

  return <button onClick={handleClick}>Clique</button>;
}
```

### 4. Estado → useState

**HTML:**

```html
<input type="text" id="name" oninput="updateName()" />
<span id="display"></span>
<script>
  function updateName() {
    const value = document.getElementById("name").value;
    document.getElementById("display").textContent = value;
  }
</script>
```

**React:**

```tsx
import { useState } from "react";

export function MyComponent() {
  const [name, setName] = useState("");

  return (
    <>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <span>{name}</span>
    </>
  );
}
```

### 5. Componentes Radix UI

No projeto real, use Radix UI para componentes avançados:

```tsx
// Select com Radix UI
import * as Select from "@radix-ui/react-select";

<Select.Root>
  <Select.Trigger className="ui-select">
    <Select.Value placeholder="Selecione..." />
  </Select.Trigger>
  <Select.Content>
    <Select.Item value="1">Opção 1</Select.Item>
    <Select.Item value="2">Opção 2</Select.Item>
  </Select.Content>
</Select.Root>;
```

---

## 🤖 Prompt para IAs

Use este prompt ao pedir para IAs criarem protótipos:

```
Crie um protótipo de interface em HTML/CSS/JS seguindo estas diretrizes:

ESTRUTURA:
- Arquivo HTML único com CSS inline no <style> e JS no <script>
- Use as variáveis CSS do ZenithSolutions (veja abaixo)
- Componentes devem usar as classes CSS fornecidas

VARIÁVEIS CSS OBRIGATÓRIAS:
- Cores: var(--ui-accent), var(--ui-bg), var(--ui-text)
- Espaçamentos: var(--ui-spacing-sm/md/lg)
- Border radius: var(--ui-radius-sm/md/lg)
- Fontes: var(--ui-font-size-sm/md/lg)

COMPONENTES BASE:
- Inputs: classe "ui-input"
- Botões: classe "ui-btn" (primário) ou "ui-btn ui-btn-secondary"
- Cards: classe "ui-card"
- Sections: classe "ui-section"
- Labels: classe "ui-label"
- Form groups: classe "ui-form-group"

TEMA:
- Suporte a tema claro e escuro via [data-theme="dark"]
- Botão de toggle: <button onclick="toggleTheme()">🌓</button>

JAVASCRIPT:
- Vanilla JS (sem frameworks)
- Funções simples e diretas
- Event listeners inline ou no <script>

ESTILO:
- Design limpo e profissional
- Inspirado em Revit/AutoCAD
- Espaçamentos consistentes
- Transições suaves (var(--ui-transition-normal))

EXEMPLO DE ESTRUTURA:
<!DOCTYPE html>
<html>
<head>
    <style>
        :root {
            --ui-accent: #5a6570;  /* Cinza no tema claro */
            --ui-bg: #ffffff;
            --ui-text: #2d2d2d;
            /* ... outras variáveis */
        }
        [data-theme="dark"] {
            --ui-accent: #8ec8ee;  /* Azul no tema escuro */
            --ui-bg: #1e2a35;  /* Azul petróleo */
            --ui-text: #e8ebed;
        }
    </style>
</head>
<body>
    <div class="ui-container">
        <div class="ui-section">
            <!-- Conteúdo -->
        </div>
    </div>
    <script>
        // JavaScript
    </script>
</body>
</html>

IMPORTANTE:
- NÃO use bibliotecas externas (Bootstrap, Tailwind, etc.)
- NÃO use Mantine (o projeto usa Radix UI, mas no protótipo use HTML puro)
- SEMPRE use as variáveis CSS fornecidas
- Mantenha o código simples e fácil de migrar para React
```

---

## 💡 Exemplos Práticos

### Exemplo 1: Formulário de Configuração

```html
<div class="ui-section">
  <h2 class="ui-section-title">Configurações da Ponte</h2>

  <div class="ui-form-row">
    <div class="ui-form-group">
      <label class="ui-label">Quantidade de Tramos</label>
      <input type="number" class="ui-input" value="3" min="1" max="20" />
    </div>

    <div class="ui-form-group">
      <label class="ui-label">Quantidade de Longarinas</label>
      <input type="number" class="ui-input" value="5" min="2" max="8" />
    </div>

    <div class="ui-form-group">
      <label class="ui-label">Altura da Longarina</label>
      <div class="ui-input-wrapper">
        <input type="number" value="1.2" step="0.1" />
        <span class="ui-input-unit">m</span>
      </div>
    </div>
  </div>

  <button class="ui-btn">Aplicar Configurações</button>
</div>
```

### Exemplo 2: Seletor de IFCs

```html
<div class="ui-section">
  <h2 class="ui-section-title">IFCs Disponíveis</h2>

  <div class="ui-form-group">
    <label class="ui-label">Filtrar por Categoria</label>
    <select class="ui-select">
      <option>Todas</option>
      <option>Superestrutura</option>
      <option>Apoio</option>
      <option>Transição</option>
    </select>
  </div>

  <div class="ui-list">
    <div class="ui-list-item">
      <div class="ui-checkbox-group">
        <input type="checkbox" id="ifc1" />
        <label for="ifc1">SUPER_5_1.2.ifc</label>
      </div>
    </div>
    <div class="ui-list-item selected">
      <div class="ui-checkbox-group">
        <input type="checkbox" id="ifc2" checked />
        <label for="ifc2">APOIO_PILAR_3x3.ifc</label>
      </div>
    </div>
  </div>
</div>
```

### Exemplo 3: Painel de Propriedades

```html
<div class="ui-card">
  <h3 style="margin-bottom: var(--ui-spacing-md);">Propriedades do Elemento</h3>

  <div class="ui-form-group">
    <label class="ui-label">Nome</label>
    <input type="text" class="ui-input" value="Viga Principal" readonly />
  </div>

  <div class="ui-form-group">
    <label class="ui-label">Tipo</label>
    <input type="text" class="ui-input" value="Superestrutura" readonly />
  </div>

  <div class="ui-form-row">
    <div class="ui-form-group">
      <label class="ui-label">Largura</label>
      <div class="ui-input-wrapper">
        <input type="number" value="0.5" />
        <span class="ui-input-unit">m</span>
      </div>
    </div>

    <div class="ui-form-group">
      <label class="ui-label">Altura</label>
      <div class="ui-input-wrapper">
        <input type="number" value="1.2" />
        <span class="ui-input-unit">m</span>
      </div>
    </div>
  </div>

  <div
    style="display: flex; gap: var(--ui-spacing-sm); margin-top: var(--ui-spacing-md);"
  >
    <button class="ui-btn-secondary ui-btn">Cancelar</button>
    <button class="ui-btn">Salvar</button>
  </div>
</div>
```

### Exemplo 4: Upload de Arquivos

```html
<div class="ui-section">
  <h2 class="ui-section-title">Upload de IFCs</h2>

  <div class="ui-form-group">
    <label class="ui-label">Categoria</label>
    <select class="ui-select" id="category">
      <option>Selecione a categoria...</option>
      <option>Superestrutura</option>
      <option>Apoio</option>
      <option>Transição</option>
      <option>Complementares</option>
    </select>
  </div>

  <div class="ui-form-group">
    <label class="ui-label">Arquivos</label>
    <input
      type="file"
      multiple
      accept=".ifc"
      style="display: none;"
      id="fileInput"
    />
    <button
      class="ui-btn-secondary ui-btn"
      onclick="document.getElementById('fileInput').click()"
    >
      📁 Selecionar Arquivos IFC
    </button>
  </div>

  <div id="fileList" style="margin-top: var(--ui-spacing-md);"></div>

  <button class="ui-btn" style="margin-top: var(--ui-spacing-md);">
    📤 Fazer Upload
  </button>
</div>

<script>
  document.getElementById("fileInput").addEventListener("change", function (e) {
    const fileList = document.getElementById("fileList");
    fileList.innerHTML = "";

    Array.from(e.target.files).forEach((file) => {
      const item = document.createElement("div");
      item.className = "ui-list-item";
      item.textContent = file.name;
      fileList.appendChild(item);
    });
  });
</script>
```

---

## 📚 Referências Rápidas

### Ícones (Lucide React no projeto, use emojis no protótipo)

- 📁 Arquivo
- 💾 Salvar
- 📤 Upload
- 📥 Download
- ⚙️ Configurações
- 🔍 Buscar
- ✏️ Editar
- 🗑️ Deletar
- ✅ Sucesso
- ❌ Erro
- ⚠️ Aviso
- ℹ️ Info
- 🌓 Tema

### Classes CSS Principais

```
.ui-container       - Container principal
.ui-card           - Card/painel
.ui-section        - Seção com borda
.ui-title          - Título principal
.ui-section-title  - Título de seção
.ui-form-row       - Grid de formulário
.ui-form-group     - Grupo de campo
.ui-label          - Label de campo
.ui-input          - Input de texto/número
.ui-select         - Select/dropdown
.ui-btn            - Botão primário
.ui-btn-secondary  - Botão secundário
.ui-checkbox-group - Grupo checkbox
.ui-slider         - Slider/range
.ui-list           - Lista
.ui-list-item      - Item de lista
.ui-badge          - Badge/tag
.ui-modal          - Modal
.ui-toolbar        - Barra de ferramentas
```

---

## ✅ Checklist de Migração

Ao migrar do protótipo HTML para React:

- [ ] Trocar `class` por `className`
- [ ] Trocar `onclick` por `onClick`
- [ ] Mover CSS inline para arquivo `.css` separado
- [ ] Importar `global-theme.css` no componente
- [ ] Converter funções JavaScript para hooks React
- [ ] Substituir `document.getElementById` por `useRef` ou `useState`
- [ ] Usar Radix UI para componentes complexos (Select, Modal, etc.)
- [ ] Usar Lucide React para ícones (substituir emojis)
- [ ] Adicionar tipos TypeScript
- [ ] Testar tema claro/escuro

---

## 🎯 Dicas Finais

1. **Sempre use variáveis CSS** - Facilita a manutenção e migração
2. **Mantenha simples** - Protótipos devem ser rápidos de criar e modificar
3. **Teste ambos os temas** - Use o botão de toggle para verificar
4. **Compartilhe com IAs** - O arquivo HTML único é perfeito para isso
5. **Documente mudanças** - Anote customizações específicas do seu protótipo
6. **Migre incrementalmente** - Não tente migrar tudo de uma vez

---

**Criado para ZenithSolutions** | Versão 1.0 | Dezembro 2024
# AI-CG-NEWS 设计系统

> 单一真相源 - 颜色、字体、组件定义

---

## 颜色调色板

### 主色系

| 变量 | 值 | 用途 |
|------|------|------|
| `--primary` | `#1e3a5f` | 深靛蓝，主色调 |
| `--primary-hover` | `#152a45` | 主色悬停态 |
| `--accent` | `#ff6b4a` | 珊瑚橙，强调色 |
| `--accent-hover` | `#e85a3a` | 强调色悬停态 |

### 文字色

| 变量 | 值 | 对比度 | 用途 |
|------|------|--------|------|
| `--text-main` | `#1a1a2e` | ≥7:1 | 正文 |
| `--text-muted` | `#5a5a6e` | ≥4.5:1 | 辅助文字 |

### 背景色

| 变量 | 值 | 用途 |
|------|------|------|
| `--bg-body` | `#f8f9fa` | 页面背景 |
| `--bg-card` | `#ffffff` | 卡片背景 |
| `--border-color` | `#e8e8ec` | 边框 |

### 阴影

| 变量 | 值 |
|------|------|
| `--shadow-sm` | `0 1px 3px rgba(30, 58, 95, 0.06)` |
| `--shadow-md` | `0 4px 12px rgba(30, 58, 95, 0.08)` |
| `--shadow-lg` | `0 8px 24px rgba(30, 58, 95, 0.12)` |

### 可访问性

| 变量 | 值 | 用途 |
|------|------|------|
| `--focus-ring-color` | `#3b82f6` | 焦点环颜色 |
| `--focus-ring-width` | `2px` | 焦点环宽度 |
| `--focus-ring-offset` | `2px` | 焦点环偏移 |

---

## 字体系统

### 字体族

| 用途 | 字体 |
|------|------|
| 正文 | `'Noto Sans SC', system-ui, sans-serif` |
| 标题 | `'Noto Serif SC', Georgia, serif` |
| 代码 | `'Fira Code', 'Monaco', monospace` |

### 字号

| 名称 | 大小 | 行高 |
|------|------|------|
| xs | 0.75rem | 1.4 |
| sm | 0.85rem | 1.5 |
| base | 1rem | 1.6 |
| lg | 1.125rem | 1.5 |
| xl | 1.25rem | 1.4 |
| 2xl | 1.5rem | 1.3 |

---

## 过渡动画

| 变量 | 值 | 用途 |
|------|------|------|
| `--transition-base` | `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` | 标准过渡 |
| `--transition-bounce` | `all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)` | 弹性过渡 |

---

## 间距系统

| 名称 | 值 |
|------|------|
| 2xs | 4px |
| xs | 8px |
| sm | 12px |
| base | 16px |
| lg | 20px |
| xl | 24px |
| 2xl | 32px |
| 3xl | 40px |

---

## 圆角

| 名称 | 值 |
|------|------|
| sm | 4px |
| base | 6px |
| md | 8px |
| lg | 12px |
| xl | 16px |
| full | 9999px |

---

## 组件速查

### 按钮

```css
.btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    transition: var(--transition-base);
}
```

### 卡片

```css
.card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
}
```

### 标签

```css
.tag {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.75rem;
}
```

---

## 深色模式预留

```css
@media (prefers-color-scheme: dark) {
    :root {
        --primary: #3b5998;
        --text-main: #e8e8ec;
        --text-muted: #a0a0b0;
        --bg-body: #121218;
        --bg-card: #1a1a24;
        --border-color: #2a2a3a;
    }
}
```

---

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

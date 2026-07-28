# personal-context-mcp

> Generated from repository-local OKF records. The Markdown/YAML bundle remains canonical.

Source: `personal-context-mcp`

The report separates the connected repository map from detailed component and key-concept views so large bundles remain reviewable.

## Connected-area overview

```mermaid
flowchart LR
    a0["docs · 28 concepts"]
    a1["repository root · 3 concepts"]
    a2["tasks · 1 concepts"]
    a0 -->|links| a1
    a0 -->|links| a2
    a1 -->|links| a0
    a2 -->|links| a0
    classDef default fill:#eef2ff,stroke:#4f46e5,color:#1e1b4b
```

## Connected component 1

### docs

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["Codebase Map"]:::knowledge
    n2["Investigation Report"]:::knowledge
    n3["Live Validation"]:::knowledge
    n4["Refactor And Repair Plan"]:::knowledge
    n5["Tool Contract Matrix"]:::knowledge
    n6["Configuration Reference"]:::knowledge
    n7["Auth Principles"]:::knowledge
    n8["Core Beliefs"]:::knowledge
    n9["Resolver Principles"]:::knowledge
    n10["Design"]:::knowledge
    n11["Test Plan"]:::knowledge
    n12["Contract Hardening"]:::knowledge
    n13["Harness Engineering"]:::knowledge
    n14["Repository Investigation"]:::knowledge
    n15["Tech Debt Tracker"]:::knowledge
    n16["Frontend"]:::knowledge
    n17["personal-context-mcp complete Markdown inventory"]:::knowledge
    n18["personal-context-mcp documentation map"]:::knowledge
    n19["personal-context-mcp repository OKF visualization"]:::knowledge
    n20["Plans"]:::knowledge
    n21["Auth Surface"]:::knowledge
    n22["Personal Context Service"]:::knowledge
    n23["Resolver Specification"]:::knowledge
    n24["Product Sense"]:::knowledge
    n25["Quality Score"]:::knowledge
    n26["Reliability"]:::knowledge
    n27["Security"]:::knowledge
    n28["Tool Reference"]:::knowledge
    n29["Glossary"]:::boundary
    n30["Personal Context MCP"]:::boundary
    n31["Adopt RKE OKF knowledge format · done"]:::boundary
    n0 -->|links| n18
    n1 -->|links| n18
    n2 -->|links| n18
    n3 -->|links| n18
    n4 -->|links| n18
    n5 -->|links| n18
    n6 -->|links| n18
    n7 -->|links| n18
    n8 -->|links| n18
    n9 -->|links| n18
    n10 -->|links| n18
    n11 -->|links| n18
    n12 -->|links| n18
    n13 -->|links| n18
    n14 -->|links| n18
    n15 -->|links| n18
    n16 -->|links| n18
    n17 -->|links| n0
    n17 -->|links| n1
    n17 -->|links| n2
    n17 -->|links| n3
    n17 -->|links| n4
    n17 -->|links| n5
    n17 -->|links| n6
    n17 -->|links| n7
    n17 -->|links| n8
    n17 -->|links| n9
    n17 -->|links| n10
    n17 -->|links| n11
    n17 -->|links| n12
    n17 -->|links| n13
    n17 -->|links| n14
    n17 -->|links| n15
    n17 -->|links| n16
    n17 -->|links| n18
    n17 -->|links| n19
    n17 -->|links| n20
    n17 -->|links| n21
    n17 -->|links| n22
    n17 -->|links| n23
    n17 -->|links| n24
    n17 -->|links| n25
    n17 -->|links| n26
    n17 -->|links| n27
    n17 -->|links| n28
    n17 -->|links| n29
    n17 -->|links| n30
    n17 -->|links| n31
    n18 -->|links| n30
    n18 -->|links| n17
    n18 -->|links| n0
    n18 -->|links| n1
    n18 -->|links| n11
    n18 -->|links| n13
    n18 -->|links| n14
    n18 -->|links| n15
    n18 -->|links| n20
    n18 -->|links| n8
    n18 -->|links| n9
    n18 -->|links| n10
    n18 -->|links| n16
    n18 -->|links| n29
    n18 -->|links| n2
    n18 -->|links| n4
    n18 -->|links| n5
    n18 -->|links| n12
    n18 -->|links| n21
    n18 -->|links| n22
    n18 -->|links| n23
    n18 -->|links| n25
    n18 -->|links| n6
    n18 -->|links| n28
    n18 -->|links| n26
    n18 -->|links| n24
    n18 -->|links| n7
    n18 -->|links| n27
    n18 -->|links| n3
    n18 -->|links| n31
    n18 -->|links| n19
    n19 -->|links| n18
    n19 -->|links| n17
    n19 -->|links| n31
    n20 -->|links| n18
    n21 -->|links| n18
    n22 -->|links| n18
    n23 -->|links| n18
    n24 -->|links| n18
    n25 -->|links| n18
    n26 -->|links| n18
    n27 -->|links| n18
    n28 -->|links| n18
    n29 -->|links| n18
    n30 -->|links| n0
    n30 -->|links| n26
    n30 -->|links| n18
    n31 -->|links| n18
    n31 -->|links| n19
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### repository root

```mermaid
flowchart LR
    n0["Architecture"]:::knowledge
    n1["personal-context-mcp complete Markdown inventory"]:::boundary
    n2["personal-context-mcp documentation map"]:::boundary
    n3["Reliability"]:::boundary
    n4["Glossary"]:::knowledge
    n5["Personal Context MCP"]:::knowledge
    n0 -->|links| n2
    n1 -->|links| n0
    n1 -->|links| n2
    n1 -->|links| n3
    n1 -->|links| n4
    n1 -->|links| n5
    n2 -->|links| n5
    n2 -->|links| n1
    n2 -->|links| n0
    n2 -->|links| n4
    n2 -->|links| n3
    n3 -->|links| n2
    n4 -->|links| n2
    n5 -->|links| n0
    n5 -->|links| n3
    n5 -->|links| n2
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### tasks

```mermaid
flowchart LR
    n0["personal-context-mcp complete Markdown inventory"]:::boundary
    n1["personal-context-mcp documentation map"]:::boundary
    n2["personal-context-mcp repository OKF visualization"]:::boundary
    n3["Adopt RKE OKF knowledge format · done"]:::task
    n0 -->|links| n1
    n0 -->|links| n2
    n0 -->|links| n3
    n1 -->|links| n0
    n1 -->|links| n3
    n1 -->|links| n2
    n2 -->|links| n1
    n2 -->|links| n0
    n2 -->|links| n3
    n3 -->|links| n1
    n3 -->|links| n2
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

## Key concept neighbourhoods

### personal-context-mcp documentation map

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["Codebase Map"]:::boundary
    n2["Investigation Report"]:::boundary
    n3["Live Validation"]:::boundary
    n4["Refactor And Repair Plan"]:::boundary
    n5["Tool Contract Matrix"]:::boundary
    n6["Configuration Reference"]:::boundary
    n7["Auth Principles"]:::boundary
    n8["Core Beliefs"]:::boundary
    n9["Resolver Principles"]:::boundary
    n10["Design"]:::boundary
    n11["Test Plan"]:::boundary
    n12["Contract Hardening"]:::boundary
    n13["Harness Engineering"]:::boundary
    n14["Repository Investigation"]:::boundary
    n15["Tech Debt Tracker"]:::boundary
    n16["Frontend"]:::boundary
    n17["personal-context-mcp complete Markdown inventory"]:::boundary
    n18["personal-context-mcp documentation map"]:::knowledge
    n19["personal-context-mcp repository OKF visualization"]:::boundary
    n20["Plans"]:::boundary
    n21["Auth Surface"]:::boundary
    n22["Personal Context Service"]:::boundary
    n23["Resolver Specification"]:::boundary
    n24["Product Sense"]:::boundary
    n25["Quality Score"]:::boundary
    n26["Reliability"]:::boundary
    n27["Security"]:::boundary
    n28["Tool Reference"]:::boundary
    n29["Glossary"]:::boundary
    n30["Personal Context MCP"]:::boundary
    n31["Adopt RKE OKF knowledge format · done"]:::boundary
    n0 -->|links| n18
    n1 -->|links| n18
    n2 -->|links| n18
    n3 -->|links| n18
    n4 -->|links| n18
    n5 -->|links| n18
    n6 -->|links| n18
    n7 -->|links| n18
    n8 -->|links| n18
    n9 -->|links| n18
    n10 -->|links| n18
    n11 -->|links| n18
    n12 -->|links| n18
    n13 -->|links| n18
    n14 -->|links| n18
    n15 -->|links| n18
    n16 -->|links| n18
    n17 -->|links| n0
    n17 -->|links| n1
    n17 -->|links| n2
    n17 -->|links| n3
    n17 -->|links| n4
    n17 -->|links| n5
    n17 -->|links| n6
    n17 -->|links| n7
    n17 -->|links| n8
    n17 -->|links| n9
    n17 -->|links| n10
    n17 -->|links| n11
    n17 -->|links| n12
    n17 -->|links| n13
    n17 -->|links| n14
    n17 -->|links| n15
    n17 -->|links| n16
    n17 -->|links| n18
    n17 -->|links| n19
    n17 -->|links| n20
    n17 -->|links| n21
    n17 -->|links| n22
    n17 -->|links| n23
    n17 -->|links| n24
    n17 -->|links| n25
    n17 -->|links| n26
    n17 -->|links| n27
    n17 -->|links| n28
    n17 -->|links| n29
    n17 -->|links| n30
    n17 -->|links| n31
    n18 -->|links| n30
    n18 -->|links| n17
    n18 -->|links| n0
    n18 -->|links| n1
    n18 -->|links| n11
    n18 -->|links| n13
    n18 -->|links| n14
    n18 -->|links| n15
    n18 -->|links| n20
    n18 -->|links| n8
    n18 -->|links| n9
    n18 -->|links| n10
    n18 -->|links| n16
    n18 -->|links| n29
    n18 -->|links| n2
    n18 -->|links| n4
    n18 -->|links| n5
    n18 -->|links| n12
    n18 -->|links| n21
    n18 -->|links| n22
    n18 -->|links| n23
    n18 -->|links| n25
    n18 -->|links| n6
    n18 -->|links| n28
    n18 -->|links| n26
    n18 -->|links| n24
    n18 -->|links| n7
    n18 -->|links| n27
    n18 -->|links| n3
    n18 -->|links| n31
    n18 -->|links| n19
    n19 -->|links| n18
    n19 -->|links| n17
    n19 -->|links| n31
    n20 -->|links| n18
    n21 -->|links| n18
    n22 -->|links| n18
    n23 -->|links| n18
    n24 -->|links| n18
    n25 -->|links| n18
    n26 -->|links| n18
    n27 -->|links| n18
    n28 -->|links| n18
    n29 -->|links| n18
    n30 -->|links| n0
    n30 -->|links| n26
    n30 -->|links| n18
    n31 -->|links| n18
    n31 -->|links| n19
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### personal-context-mcp complete Markdown inventory

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["Codebase Map"]:::boundary
    n2["Investigation Report"]:::boundary
    n3["Live Validation"]:::boundary
    n4["Refactor And Repair Plan"]:::boundary
    n5["Tool Contract Matrix"]:::boundary
    n6["Configuration Reference"]:::boundary
    n7["Auth Principles"]:::boundary
    n8["Core Beliefs"]:::boundary
    n9["Resolver Principles"]:::boundary
    n10["Design"]:::boundary
    n11["Test Plan"]:::boundary
    n12["Contract Hardening"]:::boundary
    n13["Harness Engineering"]:::boundary
    n14["Repository Investigation"]:::boundary
    n15["Tech Debt Tracker"]:::boundary
    n16["Frontend"]:::boundary
    n17["personal-context-mcp complete Markdown inventory"]:::knowledge
    n18["personal-context-mcp documentation map"]:::boundary
    n19["personal-context-mcp repository OKF visualization"]:::boundary
    n20["Plans"]:::boundary
    n21["Auth Surface"]:::boundary
    n22["Personal Context Service"]:::boundary
    n23["Resolver Specification"]:::boundary
    n24["Product Sense"]:::boundary
    n25["Quality Score"]:::boundary
    n26["Reliability"]:::boundary
    n27["Security"]:::boundary
    n28["Tool Reference"]:::boundary
    n29["Glossary"]:::boundary
    n30["Personal Context MCP"]:::boundary
    n31["Adopt RKE OKF knowledge format · done"]:::boundary
    n0 -->|links| n18
    n1 -->|links| n18
    n2 -->|links| n18
    n3 -->|links| n18
    n4 -->|links| n18
    n5 -->|links| n18
    n6 -->|links| n18
    n7 -->|links| n18
    n8 -->|links| n18
    n9 -->|links| n18
    n10 -->|links| n18
    n11 -->|links| n18
    n12 -->|links| n18
    n13 -->|links| n18
    n14 -->|links| n18
    n15 -->|links| n18
    n16 -->|links| n18
    n17 -->|links| n0
    n17 -->|links| n1
    n17 -->|links| n2
    n17 -->|links| n3
    n17 -->|links| n4
    n17 -->|links| n5
    n17 -->|links| n6
    n17 -->|links| n7
    n17 -->|links| n8
    n17 -->|links| n9
    n17 -->|links| n10
    n17 -->|links| n11
    n17 -->|links| n12
    n17 -->|links| n13
    n17 -->|links| n14
    n17 -->|links| n15
    n17 -->|links| n16
    n17 -->|links| n18
    n17 -->|links| n19
    n17 -->|links| n20
    n17 -->|links| n21
    n17 -->|links| n22
    n17 -->|links| n23
    n17 -->|links| n24
    n17 -->|links| n25
    n17 -->|links| n26
    n17 -->|links| n27
    n17 -->|links| n28
    n17 -->|links| n29
    n17 -->|links| n30
    n17 -->|links| n31
    n18 -->|links| n30
    n18 -->|links| n17
    n18 -->|links| n0
    n18 -->|links| n1
    n18 -->|links| n11
    n18 -->|links| n13
    n18 -->|links| n14
    n18 -->|links| n15
    n18 -->|links| n20
    n18 -->|links| n8
    n18 -->|links| n9
    n18 -->|links| n10
    n18 -->|links| n16
    n18 -->|links| n29
    n18 -->|links| n2
    n18 -->|links| n4
    n18 -->|links| n5
    n18 -->|links| n12
    n18 -->|links| n21
    n18 -->|links| n22
    n18 -->|links| n23
    n18 -->|links| n25
    n18 -->|links| n6
    n18 -->|links| n28
    n18 -->|links| n26
    n18 -->|links| n24
    n18 -->|links| n7
    n18 -->|links| n27
    n18 -->|links| n3
    n18 -->|links| n31
    n18 -->|links| n19
    n19 -->|links| n18
    n19 -->|links| n17
    n19 -->|links| n31
    n20 -->|links| n18
    n21 -->|links| n18
    n22 -->|links| n18
    n23 -->|links| n18
    n24 -->|links| n18
    n25 -->|links| n18
    n26 -->|links| n18
    n27 -->|links| n18
    n28 -->|links| n18
    n29 -->|links| n18
    n30 -->|links| n0
    n30 -->|links| n26
    n30 -->|links| n18
    n31 -->|links| n18
    n31 -->|links| n19
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### personal-context-mcp repository OKF visualization

```mermaid
flowchart LR
    n0["personal-context-mcp complete Markdown inventory"]:::boundary
    n1["personal-context-mcp documentation map"]:::boundary
    n2["personal-context-mcp repository OKF visualization"]:::knowledge
    n3["Adopt RKE OKF knowledge format · done"]:::boundary
    n0 -->|links| n1
    n0 -->|links| n2
    n0 -->|links| n3
    n1 -->|links| n0
    n1 -->|links| n3
    n1 -->|links| n2
    n2 -->|links| n1
    n2 -->|links| n0
    n2 -->|links| n3
    n3 -->|links| n1
    n3 -->|links| n2
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### Personal Context MCP

```mermaid
flowchart LR
    n0["Architecture"]:::boundary
    n1["personal-context-mcp complete Markdown inventory"]:::boundary
    n2["personal-context-mcp documentation map"]:::boundary
    n3["Reliability"]:::boundary
    n4["Personal Context MCP"]:::knowledge
    n0 -->|links| n2
    n1 -->|links| n0
    n1 -->|links| n2
    n1 -->|links| n3
    n1 -->|links| n4
    n2 -->|links| n4
    n2 -->|links| n1
    n2 -->|links| n0
    n2 -->|links| n3
    n3 -->|links| n2
    n4 -->|links| n0
    n4 -->|links| n3
    n4 -->|links| n2
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### Adopt RKE OKF knowledge format

```mermaid
flowchart LR
    n0["personal-context-mcp complete Markdown inventory"]:::boundary
    n1["personal-context-mcp documentation map"]:::boundary
    n2["personal-context-mcp repository OKF visualization"]:::boundary
    n3["Adopt RKE OKF knowledge format · done"]:::task
    n0 -->|links| n1
    n0 -->|links| n2
    n0 -->|links| n3
    n1 -->|links| n0
    n1 -->|links| n3
    n1 -->|links| n2
    n2 -->|links| n1
    n2 -->|links| n0
    n2 -->|links| n3
    n3 -->|links| n1
    n3 -->|links| n2
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

### Architecture

```mermaid
flowchart LR
    n0["Architecture"]:::knowledge
    n1["personal-context-mcp complete Markdown inventory"]:::boundary
    n2["personal-context-mcp documentation map"]:::boundary
    n3["Personal Context MCP"]:::boundary
    n0 -->|links| n2
    n1 -->|links| n0
    n1 -->|links| n2
    n1 -->|links| n3
    n2 -->|links| n3
    n2 -->|links| n1
    n2 -->|links| n0
    n3 -->|links| n0
    n3 -->|links| n2
    classDef task fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef workstream fill:#ede9fe,stroke:#7c3aed,color:#2e1065
    classDef tracker fill:#ffedd5,stroke:#ea580c,color:#431407
    classDef knowledge fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef boundary fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:4 3
```

## Legend

- Blue: task
- Purple: workstream
- Orange: tracker profile
- Green: durable knowledge
- Dashed neutral nodes: neighbouring context repeated from another area or key-concept view
- Time references: edges to addressable `Task.time[]` fragments
- Arrows: structured relationships or repository-local Markdown links

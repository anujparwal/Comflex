# Comflex

A cohort-based community platform for educational institutions with ring-based access control, auto-tagging from student emails, and credit economy.

## Email Regex Pattern — IIITL Student Emails

### Format

IIITL student emails follow this structure:

```
L<BranchCode><YearOfAdmission><RollNumber>@iiitl.ac.in
```

| Segment            | Description                                      | Example  |
|--------------------|--------------------------------------------------|----------|
| `L`                | Fixed prefix (literal)                           | `L`      |
| `BranchCode`       | `CS` = Computer Science, `CI` = AI, `CB` = CS-Business | `CS` |
| `YearOfAdmission`  | 4-digit year                                     | `2022`   |
| `RollNumber`       | 3+ digit roll number                             | `001`    |
| `@iiitl.ac.in`     | Fixed domain                                     |          |

**Full example**: `LCS2022001@iiitl.ac.in` → Branch: CS, Year: 2022, Roll: 001

### Regex

```regex
/^l(cs|ci|cb)(\d{4})(\d{3,})@iiitl\.ac\.in$/i
```

| Capture Group | Extracts           | Example Match |
|---------------|--------------------|---------------|
| Group 1       | Branch code        | `cs`          |
| Group 2       | Year of admission  | `2022`        |
| Group 3       | Roll number        | `001`         |

The `i` flag makes the match case-insensitive (handles both `LCS...` and `lcs...`).

### Building the Regex for Your Own Institution

Follow these steps to adapt the pattern for a different email format:

1. **Identify the fixed parts** — Characters that never change (prefix, domain).  
   Example: `L` prefix and `@iiitl.ac.in` domain → `^l` and `@iiitl\.ac\.in$`

2. **Identify the variable segments** — Parts that change per student (branch, year, roll).

3. **Build capture groups** for each variable segment:
   - **Known set of values** (e.g. branch codes) → use alternation: `(cs|ci|cb)`
   - **Fixed-length digits** (e.g. 4-digit year) → use `(\d{4})`
   - **Variable-length digits** (e.g. roll number) → use `(\d{3,})`

4. **Combine** all parts in order: `^l(cs|ci|cb)(\d{4})(\d{3,})@iiitl\.ac\.in$`

5. **Add flags** — Use `i` for case-insensitive matching.

#### Example: Adapting for a Different Institution

Suppose another institution uses: `<Year2Digit><DeptCode><RollNo>@example.edu`  
e.g. `22BCS045@example.edu`

```regex
/^(\d{2})([a-z]{2,4})(\d{3,})@example\.edu$/i
```

| Group | Extracts           |
|-------|--------------------|
| 1     | 2-digit year       |
| 2     | Department code    |
| 3     | Roll number        |

### Admin Setup

The Comflex admin panel (Setup Wizard → Step 2) lets you configure the email parsing regex from the UI. Enter your pattern, capture group index, and year offset to auto-tag students into cohort groups on registration.

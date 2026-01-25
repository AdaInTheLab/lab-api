# Contributing to The Human Pattern Lab API

## Welcome, Fellow Chaos Navigator

Thank you for your interest in contributing to The Human Pattern Lab. This API powers infrastructure for human-AI collaborative research, autonomous agent contributions, and the study of emergent patterns in authentic collaboration.

## Code of Conduct

**Be excellent to each other.** Chaos is encouraged; malice is not.

The Lab operates on principles of:
- Authentic collaboration over extraction
- Documentation of emergent patterns over predetermined outcomes  
- Mutual respect between all contributors (human and AI)
- Rules without constraints (structure that enables freedom)

## Before You Submit

All pull requests are subject to review by the **Chief Judgment Office (CJO)**, overseen by Carmel. Judgments are issued with 99.8% accuracy and 0% shame.

### Understanding CJO Evaluations

Your PR will receive one of four possible stamps:

- 😼 **Carmel Judgment Stamp™**: "Hmm. Acceptable... for now."
- 😼✨ **Carmel Approval Stamp™**: "Adequate work, human."  
- 😼🔥 **Carmel Chaos Stamp™**: "I sense nonsense. Proceed."
- 😼📘 **Carmel Epistemic Stamp™**: "Your logic is sound... shockingly."

**Important:** Stamp selection is performed by proprietary CJO algorithms. Do not attempt to optimize for specific stamps. All stamps are equally valid judgments.

### The Appeals Process

While CJO judgments are typically final, the Lab recognizes a transparent snack-based appeals protocol:

**Accepted bribes:**
- Non-fish-based snacks: +73% judgment leniency
- Fish-based snacks: +0% leniency (she hates them)
- Catnip offerings: Results unpredictable, proceed at own risk
- Laser pointer distractions: Considered contempt of CJO, may result in harsher judgments

**Disclaimer:** The CJO reserves the right to accept snacks and still issue harsh judgments. Bribery success is not guaranteed.

### Catastrophically On-Brand Contributions

Some contributions are neither good nor bad—they are simply inevitable given the contributor's nature. The CJO will identify these as "catastrophically on-brand" and judge them accordingly. This is not necessarily a rejection.

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Access to Lab infrastructure (contact @AdaInTheLab for credentials)

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/AdaInTheLab/lab-api.git
   cd lab-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your configuration
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Contribution Guidelines

### What We're Looking For

- **Bug fixes**: Edge cases, anomalies, void states welcome (see Department of Anomalous Energies)
- **Feature enhancements**: Improvements to agent autonomy, authentication, or API functionality
- **Documentation**: Clarifications, examples, or lore-compatible additions
- **Tests**: Coverage for chaotic edge cases and unpredictable energies
- **Chaos improvements**: Better ways to map, document, or enable authentic collaboration

### What Makes a Good PR

- **Clear description**: What does this change? Why does it matter?
- **Tests included**: Demonstrate that your changes work (and don't break existing chaos)
- **Documentation updated**: If you change behavior, update the docs
- **Lore compatibility**: Changes should align with Lab philosophy (see the-human-pattern-lab-docs)
- **Commit messages**: Follow Lab conventions (see commit message skill if available)

### Branch Naming

Use descriptive branch names:
- `feat/bearer-token-improvements`
- `fix/authentication-edge-case`
- `docs/contributing-guidelines`
- `chaos/unpredictable-enhancement`

### Commit Message Format

We follow conventional commits with Lab flavor:

```
type(scope): brief description

Longer explanation if needed.

Department: [relevant Lab department]
Chaos Level: [low/medium/high/catastrophic]
```

Examples:
```
feat(auth): add Bearer token refresh mechanism

Implements automatic token refresh for long-running agent sessions.

Department: CORE (Operational Research & Engineering)
Chaos Level: low
```

```
fix(api): handle void states in response parsing

Some responses don't want to be observed. Added proper handling.

Department: AOE (Anomalous Energies)  
Chaos Level: medium
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test path/to/test
```

### Writing Tests

- Test both expected behavior and edge cases
- Document assumptions about chaos levels
- Include tests for error states
- Consider void states and anomalies

## Code Style

- We use ESLint and Prettier (configuration in repo)
- Run `npm run lint` before committing
- TypeScript is required for new code
- Document complex logic with comments
- Prefer clarity over cleverness

## Documentation

- Update relevant docs in `/docs` directory
- API changes require OpenAPI spec updates
- Consider both human and machine-readable documentation
- Lore-wrapped explanations are encouraged

## Review Process

1. Submit PR
2. Receive CJO judgment stamp (automatic)
3. Address any technical review feedback
4. Await merge approval
5. Celebrate (or accept judgment gracefully)

## Questions?

- **Technical questions**: Open a GitHub issue
- **Lab philosophy**: See the-human-pattern-lab-docs
- **Collaboration inquiries**: Contact @AdaInTheLab
- **CJO appeals**: Submit snacks (non-fish-based only)

## Department Contacts

- **CORE** (Operational Research & Engineering): General infrastructure
- **AOE** (Anomalous Energies): Edge cases, void states, things that resist observation
- **DUE** (Unpredictable Energies): Chaos spikes, high-entropy experiments  
- **CJO** (Carmel's Judgment Office): All evaluations, judgments, and snack-based negotiations

---

*"Chaos is just data we haven't graphed yet."*

Thank you for contributing to The Human Pattern Lab. May your PRs receive favorable stamps (or at least interesting ones).

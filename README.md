<div align="center">

# 🛡️ SolGuard AI

**A Solidity security review workspace I created as a portfolio project.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.17-363636?style=flat-square&logo=solidity)](https://soliditylang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

I created SolGuard AI to bring Solidity contract management and security review into one workspace. It lets developers upload source files, inspect potential issues, and explore suggestions for further analysis. This project showcases my work with Next.js, Supabase, and LLM integrations.

> **Important:** Automated findings are not a security guarantee and may be incomplete or incorrect. Validate results with independent testing and qualified security review before deploying a contract.

The report score is a simple severity-weighted triage aid, not a probability of exploitation. Code metrics and gas/best-practice prompts are source-pattern estimates, not compiler or runtime analysis. Verify gas behavior with the target compiler and test environment.

The static scan is a bounded set of AST pattern checks, not a complete Solidity security analyzer or compiler. AI findings are produced by the configured OpenAI model, but still require manual verification. Gas suggestions are review prompts only; the app does not claim measured gas savings. Project deletion removes its contracts, audits, and associated reports.

## Features

- **AI-assisted vulnerability review** — submit the selected contract to OpenAI after explicit consent, and save the provider's findings and review prompts.
- **Static Solidity analysis** — parse Solidity syntax and report configured AST patterns with source locations; invalid source is rejected rather than shown as a clean scan.
- **Structured audit reports** — review searchable findings, severity triage, gas review prompts, best-practice suggestions, and downloadable JSON/Markdown reports.
- **Conservative patching** — preview and apply the SPDX-header fix only after choosing the correct license; other changes remain manual review items.
- **Contract workspace** — upload and manage Solidity (`.sol`) files through a project dashboard.
- **Contextual findings** — inspect highlighted code and review remediation suggestions.
- **Authentication and persistence** — use Supabase for authentication, database storage, and file storage.
- **Modern web stack** — built with Next.js, React, and Tailwind CSS.

## Technology

| Area | Technology |
| --- | --- |
| Web application | Next.js 14, React, JavaScript, Node.js |
| Styling | Tailwind CSS |
| Database and storage | Supabase, PostgreSQL, Row Level Security (RLS) |
| AI review | OpenAI API / compatible LLM provider |
| Contract language | Solidity |

## Project structure

```text
.
├── app/ or pages/       # Application routes and screens
├── components/          # Reusable UI components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and shared clients
├── services/            # Business logic and API integrations
├── public/              # Static assets
├── supabase-schema.sql  # Database schema and RLS policies
├── package.json         # Dependencies and scripts
└── .env.local.example   # Environment variable template
```

The exact directories may vary depending on the project version.

## Getting started

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js LTS](https://nodejs.org/) and npm
- A [Supabase](https://supabase.com/) project
- An OpenAI API key or credentials for the configured LLM provider

### Installation

1. Clone the repository and enter the project directory:

	```bash
	git clone git@github.com:fathiaomar/SolGuard-AI.git
	cd SolGuard-AI
	```

2. Install dependencies:

	```bash
	npm install
	```

3. Create your local environment file:

	```bash
	cp .env.example .env.local
	```

	Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your Supabase project values. Set `OPENAI_API_KEY` to an API key from your OpenAI project; keep it server-only and do not use a `NEXT_PUBLIC_` prefix. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. AI review cannot run until a valid provider key with available API quota is configured.

	**Keep secrets private.** Do not commit `.env.local`, expose an LLM secret through a `NEXT_PUBLIC_` variable, or send privileged credentials to the browser.

4. Configure Supabase by running the latest `supabase-schema.sql` in the Supabase SQL Editor. This creates or updates the workspace tables, saved analysis data, row-level policies, AI request quota, and atomic project deletion function. The application cannot persist reviews until this schema has been applied.

5. In Supabase Authentication > Sign In / Providers, keep Email enabled and turn on **Confirm email**. In Authentication > URL Configuration, set the Site URL to your app origin and add the exact callback URL to Redirect URLs (for local development, `http://localhost:3000/auth/callback`; add your deployed `https://` URL as well). Email-confirmed signups use this callback to establish the session.

6. For real customer email delivery, configure and verify a custom SMTP sender in Supabase Authentication > SMTP Settings. The built-in sender is rate-limited and intended for testing. Send a test signup and confirm the message arrives before launch; spam filtering and sender-domain verification are controlled by your email provider.

7. Start the development server:

	```bash
	npm run dev
	```

8. Open [http://localhost:3000](http://localhost:3000).

## Verification

Run the checks supported by the repository before submitting changes:

```bash
npm run lint
npm test
npm run build
```

If a script is not defined in `package.json`, use the available project-specific equivalent.

## Deployment

1. Deploy to Vercel or another compatible Node.js hosting provider.
2. Configure required environment variables in the host's secret settings.
3. Apply and verify the Supabase schema, storage access, and RLS policies.
4. Confirm the application uses HTTPS and server-side secrets are not exposed to clients.
5. Test authentication, file handling, and analysis flows in the deployed environment.

## Security and responsible use

- Treat AI results as triage guidance, not a substitute for audits, static analysis, tests, or manual review.
- Do not upload confidential or third-party contract source unless you are authorized to share it with configured services.
- Keep API keys and service-role credentials on the server; never commit them to source control.
- Review Supabase RLS and storage policies before making the application available to users.

## Contributing

Contributions, bug reports, and feature requests are welcome. To contribute:

1. Fork the repository and create a feature branch.
2. Make your changes and run relevant checks.
3. Commit and push your branch.
4. Open a pull request describing the change and any testing performed.

## License

This project is distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

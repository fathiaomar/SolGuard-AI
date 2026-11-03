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

## Features

- **AI-assisted vulnerability review** — identify potential risks, suspicious patterns, and areas for closer inspection.
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
	cp .env.local.example .env.local
	```

	Add the variables required by the application, including your Supabase project URL, anon key, and server-side LLM API key. Check the environment template and application code for exact variable names.

	**Keep secrets private.** Do not commit `.env.local`, expose an LLM secret through a `NEXT_PUBLIC_` variable, or send privileged credentials to the browser.

4. Configure Supabase by running `supabase-schema.sql` in the Supabase SQL Editor. Verify that tables, storage configuration, and RLS policies match the application's needs.

5. Start the development server:

	```bash
	npm run dev
	```

6. Open [http://localhost:3000](http://localhost:3000).

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

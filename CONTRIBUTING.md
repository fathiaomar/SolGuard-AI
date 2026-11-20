# Contributing to SolGuard AI

Thank you for your interest in contributing to **SolGuard AI** (`fathiaomar/SolGuard-AI`)! Whether you are fixing bugs, improving Solidity pattern checks, refining the workspace UI, updating documentation, or strengthening database and auth flows, your contributions are welcome.

---

## Table of Contents

- [Code of Conduct & Ground Rules](#code-of-conduct--ground-rules)
- [Project Overview & Architecture](#project-overview--architecture)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Running Checks & Tests](#running-checks--tests)
- [How to Contribute](#how-to-contribute)
- [Guidelines by Area](#guidelines-by-area)
- [Pull Request Checklist](#pull-request-checklist)
- [Need Help?](#need-help)

---

## Code of Conduct & Ground Rules

- Be constructive, clear, and respectful in issues, discussions, and pull requests.
- Keep changes focused on the problem being solved—avoid unrelated refactors or mass reformatting inside a feature or bug-fix PR.
- Be transparent about scope and limitations: **SolGuard AI** is a review and triage workspace, not a formal verifier, compiler guarantee, or substitute for an independent smart contract security audit.

---

## Project Overview & Architecture

SolGuard AI is a web application built with **Next.js**, **React**, **Tailwind CSS**, and **Supabase** that helps users organize Solidity projects, inspect `.sol` source code, run pattern checks, optionally request AI-assisted review, and export structured reports.

High-level directory layout:

- `app/` — Application routes, pages, and API/auth handlers
- `components/` — Reusable UI components and workspace panels
- `hooks/` — Custom React hooks
- `lib/` — Shared utilities, helpers, and client setup
- `services/` — Business logic, analysis/report workflows, and external service integrations
- `utils/` — Additional utility modules
- `middleware.js` — Request/session middleware
- `supabase-schema.sql` — Database schema, RLS policies, quotas, and helper functions
- `.env.example` / `.env.local.example` — Environment variable templates

---

## Prerequisites

Before setting up the project locally, make sure you have:

1. **Git** installed and configured with SSH or HTTPS access to GitHub.
2. **Node.js (LTS)** and `npm` installed.
3. A **Supabase** project for authentication, PostgreSQL persistence, and storage.
4. An **OpenAI API key** (or compatible configured LLM provider key with available API quota) if you plan to test AI-assisted reviews.

---

## Local Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone [https://github.com/](https://github.com/)<your-username>/SolGuard-AI.git
   cd SolGuard-AI

# README Language Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the mixed bilingual README into an English primary `README.md` and a Chinese `README.zh-CN.md` with cross-links.

**Architecture:** Keep the existing README structure and content scope, but separate the languages into two mirrored documents. `README.md` remains the GitHub landing document, while `README.zh-CN.md` serves Simplified Chinese readers.

**Tech Stack:** Markdown, GitHub repository documentation

---

### Task 1: Prepare the English primary README

**Files:**
- Modify: `README.md`

**Step 1: Remove mixed bilingual paragraphs**

Keep only the English content for each existing section.

**Step 2: Add language switch links**

Add links at the top of `README.md` pointing to `README.md` and `README.zh-CN.md`.

**Step 3: Keep section coverage aligned**

Retain overview, capabilities, tech stack, architecture, status, quick start, environment variables, project structure, related docs, and notes.

### Task 2: Create the Simplified Chinese README

**Files:**
- Create: `README.zh-CN.md`

**Step 1: Mirror the English structure**

Use the same sections as `README.md`.

**Step 2: Keep only Chinese content**

Remove all English paragraphs and rewrite headings where needed to read naturally in Chinese.

**Step 3: Add language switch links**

Add links at the top of `README.zh-CN.md` pointing to `README.md` and `README.zh-CN.md`.

### Task 3: Verify documentation output

**Files:**
- Modify: `README.md`
- Create: `README.zh-CN.md`

**Step 1: Read both files**

Confirm the split is correct and the sections match.

**Step 2: Check Git diff**

Run: `git diff -- README.md README.zh-CN.md`

Expected: `README.md` becomes English-only, `README.zh-CN.md` becomes Chinese-only.

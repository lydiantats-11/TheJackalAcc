/**
 * Procedure guides (step-by-step articles), written from official sources and kept under version control.
 * Each file states its sources and the date they were read. New articles start as drafts (flags.draft = true)
 * and are only published after the owner approves them.
 */
import type { Article } from "@/lib/site/guide-catalog";
import { UNEMPLOYMENT_APPLICATION } from "./unemployment-application";

export const PROCEDURE_ARTICLES: Article[] = [UNEMPLOYMENT_APPLICATION];

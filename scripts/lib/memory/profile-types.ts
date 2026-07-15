// scripts/lib/memory/profile-types.ts — local mirror of the @astragenie/memory-provider
// AgentProfile contract (Task 0). Kept local so dev-team builds before the package
// ships profile()/feedback(); swap the import once the package exports these.
export interface AgentProfileLesson {
  id: string;
  text: string;
  importance: number;
  usefulness: number;
  created_at: number;
}
export interface AgentProfileDecision {
  id: string;
  text: string;
  importance: number;
  created_at: number;
}
export interface AgentProfileCorrection {
  id: string;
  type: string;
  text: string;
  action: "invalidated" | "superseded";
  reason: string | null;
  superseded_by: string | null;
  superseding_text: string | null;
  corrected_at: number;
}
export interface AgentProfile {
  agent: string;
  counts: Record<string, number>;
  total: number;
  first_seen: number | null;
  last_active: number | null;
  top_lessons: AgentProfileLesson[];
  recent_decisions: AgentProfileDecision[];
  corrections: AgentProfileCorrection[];
}

/** Duck-typed view of the resolved provider's OPTIONAL profile/feedback methods
 *  (Task 0 upstream contract). Both may be absent until the package ships them. */
export interface ProfileCapableProvider {
  profile?(agent: string): Promise<AgentProfile | null>;
  feedback?(atomId: string, opts: { used: boolean }): Promise<boolean>;
}

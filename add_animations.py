import re

with open("apps/web/app/(dashboard)/tracker/page.tsx", "r") as f:
    content = f.read()

# 1. Staggered entrance for RoadmapTreeView
roadmap_tree_old = """function RoadmapTreeView({
  sortedTerms,
}: {
  sortedTerms: [number, RoadmapNode[]][];
}) {
  return (
    <div className="space-y-4">
      {sortedTerms.map(([term, nodes]) => (
        <TreeViewTerm key={term} termNumber={term} nodes={nodes} />
      ))}
    </div>
  );
}"""
roadmap_tree_new = """function RoadmapTreeView({
  sortedTerms,
}: {
  sortedTerms: [number, RoadmapNode[]][];
}) {
  return (
    <div className="space-y-4">
      {sortedTerms.map(([term, nodes], idx) => (
        <div 
          key={term}
          className="opacity-0 animate-[fade-in-up_0.5s_ease-out_forwards]"
          style={{ animationDelay: `${idx * 150}ms` }}
        >
          <TreeViewTerm termNumber={term} nodes={nodes} />
        </div>
      ))}
    </div>
  );
}"""
content = content.replace(roadmap_tree_old, roadmap_tree_new)

# 2. Smooth expand for TreeViewTerm
term_details_old = """      {isOpen && (
        <div className="p-4 pt-0 border-t border-neutral-800/20 mt-1">
          <div className="space-y-2 mt-3">
            {nodes.map((n) => (
              <TreeViewNode key={n.course_id} node={n} />
            ))}
          </div>
        </div>
      )}"""
term_details_new = """      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-0 border-t border-neutral-800/20 mt-1">
            <div className="space-y-2 mt-3">
              {nodes.map((n) => (
                <TreeViewNode key={n.course_id} node={n} />
              ))}
            </div>
          </div>
        </div>
      </div>"""
content = content.replace(term_details_old, term_details_new)

# 3. Smooth expand for TreeViewNode
node_details_old = """      {isExpanded && hasDetails && (
        <div
          className="border-t border-neutral-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/40 p-4 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >"""
node_details_new = """      <div
        className={`grid transition-all duration-300 ease-in-out ${isExpanded && hasDetails ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div
            className="border-t border-neutral-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/40 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >"""
content = content.replace(node_details_old, node_details_new)

# Fix the closing div for TreeViewNode
node_close_old = """          </div>
        </div>
      )}
    </div>"""
node_close_new = """          </div>
        </div>
      </div>
    </div>"""
content = content.replace(node_close_old, node_close_new)


with open("apps/web/app/(dashboard)/tracker/page.tsx", "w") as f:
    f.write(content)

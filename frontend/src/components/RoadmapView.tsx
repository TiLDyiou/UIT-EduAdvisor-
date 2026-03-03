"use client";

/**
 * RoadmapView.tsx — Cây lộ trình môn học sử dụng React Flow.
 *
 * Features:
 * - Render môn học dưới dạng node theo semester level
 * - Color coding: Xanh (Đạt) / Vàng (Đang học) / Đỏ (Rớt) / Xám (Chưa học)
 * - Edges: kết nối prerequisites
 * - Custom node component hiển thị tên môn + điểm
 */

import { useMemo, type FC } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";

import type { SubjectResponse, GradeResponse, GradeStatus } from "@/lib/api";

// =============================================================================
// TYPES
// =============================================================================

interface SubjectNodeData {
  ma_mon: string;
  ten_mon: string;
  so_tin_chi: number;
  status: GradeStatus | "CHUA_HOC";
  diem_so: number | null;
  diem_chu: string | null;
  [key: string]: unknown;
}

interface RoadmapViewProps {
  subjects: SubjectResponse[];
  grades: GradeResponse[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 50;
const SEMESTER_LABEL_HEIGHT = 40;

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  DAT: { bg: "rgba(16, 185, 129, 0.15)", border: "#10b981", text: "#34d399" },
  DANG_HOC: { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fbbf24" },
  ROT: { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#f87171" },
  CHUA_HOC: { bg: "rgba(100, 116, 139, 0.15)", border: "#64748b", text: "#cbd5e1" },
};

const STATUS_LABELS: Record<string, string> = {
  DAT: "Đã đạt",
  DANG_HOC: "Đang học",
  ROT: "Rớt",
  CHUA_HOC: "Chưa học",
};

// =============================================================================
// CUSTOM NODE COMPONENT
// =============================================================================

const SubjectNode: FC<NodeProps<Node<SubjectNodeData>>> = ({ data }) => {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.CHUA_HOC;

  return (
    <div
      className="subject-node"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        color: colors.text,
        borderWidth: "1px",
        borderStyle: "solid",
        borderRadius: "16px",
        padding: "12px 16px",
        width: `${NODE_WIDTH}px`,
        minHeight: `${NODE_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
        backdropFilter: "blur(12px)",
        transition: "all 0.3s ease",
        cursor: "default",
        fontSize: "13px",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: "8px", height: "8px" }} />

      {/* Subject Code */}
      <div style={{ fontWeight: 700, fontSize: "11px", opacity: 0.8, letterSpacing: "1px" }}>
        {data.ma_mon}
      </div>

      {/* Subject Name */}
      <div
        style={{
          fontWeight: 700,
          fontSize: "13px",
          lineHeight: 1.4,
          marginTop: "4px",
          color: "#f8fafc",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}
        title={data.ten_mon}
      >
        {data.ten_mon}
      </div>

      {/* Grade & Status */}
      <div
        style={{
          marginTop: "6px",
          fontSize: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ opacity: 0.7, fontWeight: 500 }}>{data.so_tin_chi} TC</span>
        {data.diem_so !== null && (
          <span style={{ fontWeight: 800, color: colors.border }}>
            {data.diem_so} {data.diem_chu ? `(${data.diem_chu})` : ""}
          </span>
        )}
        {data.diem_so === null && (
          <span style={{ fontSize: "11px", fontWeight: 600 }}>{STATUS_LABELS[data.status].replace(/[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83d\ude00-\ude4f]|[\ud83d\ude80-\udecf]|[\ud83d\udc00-\udcff]|[\ud83d\udfc0-\udfdf]/g, '')}</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: "8px", height: "8px" }} />
    </div>
  );
};

const nodeTypes = { subjectNode: SubjectNode };

// =============================================================================
// MAIN COMPONENT (NỘI TẠI FLOW ĐỂ DÙNG HOOKS)
// =============================================================================

function RoadmapFlow({ subjects, grades }: RoadmapViewProps) {
  // Dùng html-to-image để tải viewport của roadmap

  // Handle Download Ảnh
  const onClickDownload = () => {
    // Lấy vùng hiển thị của viewport
    const viewportNode = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (viewportNode) {
      toPng(viewportNode, {
        backgroundColor: "#0f172a", // Background nền tối
        width: viewportNode.scrollWidth,
        height: viewportNode.scrollHeight,
        style: {
          width: `${viewportNode.scrollWidth}px`,
          height: `${viewportNode.scrollHeight}px`,
          transform: "translate(0, 0) scale(1)",
        },
      }).then((dataUrl) => {
        const link = document.createElement("a");
        link.download = "uit-eduadvisor-roadmap.png";
        link.href = dataUrl;
        link.click();
      });
    }
  };

  // Map grades by subject code for quick lookup
  const gradeMap = useMemo(() => {
    const map = new Map<string, GradeResponse>();
    grades.forEach((g) => map.set(g.subject_code, g));
    return map;
  }, [grades]);

  // Generate nodes & edges
  const { nodes, edges } = useMemo(() => {
    // Use Node<Record<string, unknown>> to allow both label nodes and subject nodes
    const nodeList: Node<Record<string, unknown>>[] = [];
    const edgeList: Edge[] = [];

    // Group subjects by semester level
    const semesterGroups = new Map<number, SubjectResponse[]>();
    subjects.forEach((s) => {
      const level = s.semester_level;
      if (!semesterGroups.has(level)) {
        semesterGroups.set(level, []);
      }
      semesterGroups.get(level)!.push(s);
    });

    // Sort semester levels
    const sortedLevels = Array.from(semesterGroups.keys()).sort((a, b) => a - b);

    // Calculate Y position for each semester level
    let yOffset = 0;

    sortedLevels.forEach((level) => {
      const semesterSubjects = semesterGroups.get(level)!;

      // Add semester label node
      const labelId = `semester-label-${level}`;

      nodeList.push({
        id: labelId,
        type: "default",
        position: { x: -60, y: yOffset },
        data: { label: `KỲ ${level}` },
        style: {
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(56, 189, 248, 0.4))",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "8px",
          padding: "6px 12px",
          fontSize: "13px",
          fontWeight: "800",
          color: "#f8fafc",
          width: "auto",
          pointerEvents: "none" as const,
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          backdropFilter: "blur(10px)",
          letterSpacing: "1px"
        },
        selectable: false,
        draggable: false,
      });

      yOffset += SEMESTER_LABEL_HEIGHT;

      // Add subject nodes for this semester
      semesterSubjects.forEach((subject, index) => {
        const grade = gradeMap.get(subject.ma_mon);
        const status: GradeStatus | "CHUA_HOC" = grade ? grade.trang_thai : "CHUA_HOC";

        const node: Node<Record<string, unknown>> = {
          id: subject.ma_mon,
          type: "subjectNode",
          position: {
            x: index * (NODE_WIDTH + HORIZONTAL_GAP),
            y: yOffset,
          },
          data: {
            ma_mon: subject.ma_mon,
            ten_mon: subject.ten_mon,
            so_tin_chi: subject.so_tin_chi,
            status,
            diem_so: grade?.diem_so ?? null,
            diem_chu: grade?.diem_chu ?? null,
          },
        };

        nodeList.push(node);

        // Add edges for prerequisites
        if (subject.prerequisites) {
          subject.prerequisites.forEach((prereq) => {
            edgeList.push({
              id: `${prereq}-${subject.ma_mon}`,
              source: prereq,
              target: subject.ma_mon,
              animated: status === "DANG_HOC",
              style: {
                stroke: STATUS_COLORS[status]?.border || "rgba(255,255,255,0.2)",
                strokeWidth: 2,
              },
            });
          });
        }
      });

      yOffset += NODE_HEIGHT + VERTICAL_GAP;
    });

    return { nodes: nodeList, edges: edgeList };
  }, [subjects, gradeMap]);

  return (
    <div className="roadmap-container">
      {/* Legend */}
      <div className="roadmap-legend">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="legend-item">
            <div
              className="legend-dot"
              style={{
                background: STATUS_COLORS[key].bg,
                borderColor: STATUS_COLORS[key].border,
              }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* React Flow Canvas */}
      <div className="roadmap-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.15)" />
          <Controls className="react-flow__controls" />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as SubjectNodeData;
              return STATUS_COLORS[data?.status]?.border || "#64748b";
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
            style={{ backgroundColor: "rgba(30, 41, 59, 1)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
          />
          <Panel position="top-right">
            <button
              onClick={onClickDownload}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "linear-gradient(135deg, #a78bfa, #38bdf8)", border: "none", color: "#fff",
                padding: "8px 16px", borderRadius: "12px", cursor: "pointer",
                fontWeight: 700, fontSize: "13px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
              }}
            >
              <Download size={16} /> Tải ảnh Lộ trình
            </button>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function RoadmapView(props: RoadmapViewProps) {
  return (
    <ReactFlowProvider>
      <RoadmapFlow {...props} />
    </ReactFlowProvider>
  );
}

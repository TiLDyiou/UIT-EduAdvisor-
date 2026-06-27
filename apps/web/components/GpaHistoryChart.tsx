"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { ChartsContainer } from "@mui/x-charts/ChartsContainer";
import { LinePlot, MarkPlot } from "@mui/x-charts/LineChart";
import { BarPlot } from "@mui/x-charts/BarChart";
import { ChartsXAxis } from "@mui/x-charts/ChartsXAxis";
import { ChartsYAxis } from "@mui/x-charts/ChartsYAxis";
import { ChartsGrid } from "@mui/x-charts/ChartsGrid";
import { ChartsTooltip } from "@mui/x-charts/ChartsTooltip";
import { ChartsLegend } from "@mui/x-charts/ChartsLegend";

interface RoadmapNode {
  course_id: number;
  course_code: string;
  course_name: string;
  credits: number;
  term_number: number;
  status: string;
  grade_10: number | null;
}

export function GpaHistoryChart({ nodes }: { nodes: RoadmapNode[] }) {
  const [themeMode, setThemeMode] = React.useState<"light" | "dark">("dark");

  React.useEffect(() => {
    // Initial check
    const isDark = document.documentElement.classList.contains("dark");
    setThemeMode(isDark ? "dark" : "light");

    // Listen for class changes on html tag
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          const isDarkNow = document.documentElement.classList.contains("dark");
          setThemeMode(isDarkNow ? "dark" : "light");
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const isDark = themeMode === "dark";

  const muiTheme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? "dark" : "light",
          background: {
            paper: isDark ? "#1a1b26" : "#ffffff", // tokyo-night bg
          },
          text: {
            primary: isDark ? "#a9b1d6" : "#4c4f69",
            secondary: isDark ? "#9aa5ce" : "#5c5f77",
          },
        },
        typography: {
          fontFamily: "inherit",
        },
      }),
    [isDark],
  );

  const dataset = React.useMemo(() => {
    const termsMap = new Map<
      number,
      { totalGradeCredits: number; totalCredits: number; passedCredits: number; hasInProgress: boolean }
    >();

    nodes.forEach((n) => {
      const current = termsMap.get(n.term_number) || {
        totalGradeCredits: 0,
        totalCredits: 0,
        passedCredits: 0,
        hasInProgress: false,
      };

      if (n.grade_10 !== null && n.grade_10 !== undefined) {
        current.totalGradeCredits += n.grade_10 * n.credits;
        current.totalCredits += n.credits;
        if (n.grade_10 >= 5.0) {
          current.passedCredits += n.credits;
        }
      }
      
      if (n.status === "in_progress") {
        current.hasInProgress = true;
      }
      
      termsMap.set(n.term_number, current);
    });

    const sortedTerms = Array.from(termsMap.keys())
      .filter((term) => !termsMap.get(term)!.hasInProgress && termsMap.get(term)!.totalCredits > 0)
      .sort((a, b) => a - b);
      
    return sortedTerms.map((term) => {
      const data = termsMap.get(term)!;
      
      return {
        term: `Kỳ ${term}`,
        gpa: Number((data.totalGradeCredits / data.totalCredits).toFixed(2)),
        credits: data.passedCredits,
      };
    });
  }, [nodes]);

  if (dataset.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-tokyo-comment text-sm">
        Chưa có dữ liệu điểm để hiển thị biểu đồ
      </div>
    );
  }

  const colors = {
    gpa: isDark ? "#7dcfff" : "#04a5e5", // tokyo-cyan
    credits: isDark ? "rgba(122, 162, 247, 0.4)" : "rgba(30, 102, 245, 0.4)", // tokyo-blue transparent
    grid: isDark ? "rgba(65, 72, 104, 0.5)" : "rgba(172, 176, 190, 0.5)",
  };

  const series = [
    {
      type: "bar",
      dataKey: "credits",
      color: colors.credits,
      yAxisId: "rightAxis",
      label: "Số tín chỉ",
    },
    {
      type: "line",
      dataKey: "gpa",
      color: colors.gpa,
      showMark: true,
      yAxisId: "leftAxis",
      label: "GPA Học kỳ",
    },
  ] as const;

  return (
    <ThemeProvider theme={muiTheme}>
      <Box sx={{ width: "100%", height: 350 }}>
        <ChartsContainer
          series={series}
          xAxis={[
            {
              scaleType: "band",
              dataKey: "term",
              label: "",
            },
          ]}
          yAxis={[
            {
              id: "leftAxis",
              min: 0,
              max: 10,
              label: "Điểm trung bình (GPA)",
            },
            {
              id: "rightAxis",
              position: "right",
              label: "Tín chỉ tích lũy",
            },
          ]}
          dataset={dataset}
          sx={{
            "& .MuiChartsAxis-tick": { stroke: colors.grid },
            "& .MuiChartsAxis-line": { stroke: colors.grid },
            "& .MuiChartsLegend-root": { mb: 2 },
            "& .MuiChartsGrid-line": { stroke: colors.grid, opacity: 0.5 },
          }}
        >
          <ChartsGrid horizontal />
          <BarPlot />
          <LinePlot />
          <MarkPlot />
          <ChartsXAxis />
          <ChartsYAxis axisId="leftAxis" />
          <ChartsYAxis axisId="rightAxis" />
          <ChartsLegend direction="row" position={{ vertical: 'top', horizontal: 'middle' }} />
          <ChartsTooltip trigger="axis" />
        </ChartsContainer>
      </Box>
    </ThemeProvider>
  );
}

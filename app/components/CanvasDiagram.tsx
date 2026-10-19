"use client";

import { useEffect, useRef } from "react";

export interface DualSeriesDataPoint {
  label: string;
  val1: number;
  val2: number;
}

interface DualSeriesCanvasChartProps {
  title?: string;
  subtitle?: string;
  series1Label?: string;
  series2Label?: string;
  series1Color?: string;
  series2Color?: string;
  data: DualSeriesDataPoint[];
  height?: number;
}

export function DualSeriesCanvasChart({
  title = "Sales & Profit Volume Trends",
  subtitle = "Dynamic Canvas visual trend analytics",
  series1Label = "Total Sales",
  series2Label = "Net Pure Profit",
  series1Color = "#fe9f43", // Dreams POS Brand Orange
  series2Color = "#10b981", // POS Emerald Green
  data,
  height = 240,
}: DualSeriesCanvasChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, width, h);

    if (!data || data.length === 0) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data available for diagram", width / 2, h / 2);
      return;
    }

    const padding = { top: 25, right: 25, bottom: 35, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxValRaw = Math.max(
      ...data.flatMap((d) => [d.val1 || 0, d.val2 || 0]),
      10
    );
    const maxVal = Math.ceil(maxValRaw / 20) * 20 || 50;

    const gridRows = 4;

    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridRows; i++) {
      const y = padding.top + (chartH / gridRows) * i;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const val = Math.round(maxVal - (maxVal / gridRows) * i);
      ctx.fillStyle = "#64748b";
      ctx.font = "600 11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`Rs.${val}`, padding.left - 8, y + 4);
    }

    const pts1 = data.map((d, idx) => {
      const x = padding.left + (chartW / Math.max(data.length - 1, 1)) * idx;
      const y = padding.top + chartH - ((d.val1 || 0) / maxVal) * chartH;
      return { x, y, label: d.label, val: d.val1 };
    });

    const pts2 = data.map((d, idx) => {
      const x = padding.left + (chartW / Math.max(data.length - 1, 1)) * idx;
      const y = padding.top + chartH - ((d.val2 || 0) / maxVal) * chartH;
      return { x, y, label: d.label, val: d.val2 };
    });

    if (pts1.length > 0) {
      ctx.beginPath();
      ctx.moveTo(pts1[0].x, pts1[0].y);
      for (let i = 1; i < pts1.length; i++) {
        const xc = (pts1[i].x + pts1[i - 1].x) / 2;
        const yc = (pts1[i].y + pts1[i - 1].y) / 2;
        ctx.quadraticCurveTo(pts1[i - 1].x, pts1[i - 1].y, xc, yc);
      }
      ctx.lineTo(pts1[pts1.length - 1].x, pts1[pts1.length - 1].y);
      ctx.lineTo(pts1[pts1.length - 1].x, h - padding.bottom);
      ctx.lineTo(pts1[0].x, h - padding.bottom);
      ctx.closePath();

      const fillGrad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
      fillGrad.addColorStop(0, "rgba(254, 159, 67, 0.22)");
      fillGrad.addColorStop(1, "rgba(254, 159, 67, 0.0)");
      ctx.fillStyle = fillGrad;
      ctx.fill();
    }

    const drawSmoothCurve = (
      points: Array<{ x: number; y: number }>,
      strokeColor: string,
      nodeFillColor: string
    ) => {
      if (points.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.8;
      ctx.stroke();

      points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
    };

    drawSmoothCurve(pts2, series2Color, series2Color);

    drawSmoothCurve(pts1, series1Color, series1Color);

    pts1.forEach((p) => {
      ctx.fillStyle = "#475569";
      ctx.font = "600 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.label, p.x, h - padding.bottom + 20);
    });
  }, [data, series1Color, series2Color, height]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card font-sans">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <h3 className="text-base font-extrabold text-stone-900 tracking-tight">
            {title}
          </h3>
          {subtitle && <p className="text-xs text-stone-500 font-medium">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-amber-900 border border-orange-200">
            <span
              className="h-2.5 w-2.5 rounded-full inline-block"
              style={{ backgroundColor: series1Color }}
            />
            <span>{series1Label}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-900 border border-emerald-200">
            <span
              className="h-2.5 w-2.5 rounded-full inline-block"
              style={{ backgroundColor: series2Color }}
            />
            <span>{series2Label}</span>
          </div>
        </div>
      </div>

      <div className="w-full rounded-xl bg-stone-50/50 p-1 border border-stone-100">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ height: `${height}px` }}
        />
      </div>
    </div>
  );
}

export function SalesCanvasChart({
  salesData,
  height = 220,
}: {
  salesData: Array<{ label: string; amount: number }>;
  height?: number;
}) {
  const transformedData: DualSeriesDataPoint[] = salesData.map((d) => ({
    label: d.label,
    val1: d.amount,
    val2: Math.round(d.amount * 0.7),
  }));

  return (
    <DualSeriesCanvasChart
      title="Sales & Revenue Trends"
      subtitle="HTML5 Canvas Interactive POS Graph"
      series1Label="Gross Sales"
      series2Label="Net Target"
      series1Color="#fe9f43"
      series2Color="#10b981"
      data={transformedData}
      height={height}
    />
  );
}

export function ProfitCanvasChart({
  revenue,
  cost,
  expenses,
  netProfit,
  height = 240,
}: {
  revenue: number;
  cost: number;
  expenses: number;
  netProfit: number;
  height?: number;
}) {
  const profitData: DualSeriesDataPoint[] = [
    { label: "Revenue", val1: revenue, val2: revenue * 0.8 },
    { label: "Cost", val1: cost, val2: cost * 0.9 },
    { label: "Expenses", val1: expenses, val2: expenses * 1.1 },
    { label: "Pure Profit", val1: Math.max(0, netProfit), val2: Math.max(0, netProfit * 0.85) },
  ];

  return (
    <DualSeriesCanvasChart
      title="Profit & Purchase Audit Diagram"
      subtitle="Secret Admin Pure Profit vs Costs Visual Chart"
      series1Label="Income/Revenue"
      series2Label="Pure Profit"
      series1Color="#fe9f43"
      series2Color="#10b981"
      data={profitData}
      height={height}
    />
  );
}

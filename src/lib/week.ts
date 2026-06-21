export type WeekBias = {
  dayName: string;
  label: string;
  description: string;
};

const WEEK: WeekBias[] = [
  {
    dayName: "Sunday",
    label: "Recovery / Bridge",
    description: "Low-pressure capture, decompression, and bridge into the next cycle.",
  },
  {
    dayName: "Monday",
    label: "Compile / Select",
    description: "Compile state and select expressed fronts.",
  },
  {
    dayName: "Tuesday",
    label: "Build",
    description: "Production and strong artifact creation.",
  },
  {
    dayName: "Wednesday",
    label: "Repair + Build",
    description: "Fix structural blockers while continuing production.",
  },
  {
    dayName: "Thursday",
    label: "Externalize / Integrate",
    description: "Send, publish, deploy, connect, and integrate.",
  },
  {
    dayName: "Friday",
    label: "Reingest / Close",
    description: "Compress the week into state, evidence, and next pointers.",
  },
  {
    dayName: "Saturday",
    label: "Light Homeostasis",
    description: "Gentle maintenance, optional play, no major new fronts by default.",
  },
];

export function getWeekBias(date = new Date()): WeekBias {
  return WEEK[date.getDay()];
}

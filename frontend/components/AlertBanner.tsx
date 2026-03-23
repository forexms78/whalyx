"use client";

interface Props {
  alerts: string[];
}

const getAlertStyle = (alert: string) => {
  if (alert.includes("[위험") || alert.includes("[전체 경보]"))
    return "bg-red-900/30 border-red-800 text-red-300";
  if (alert.includes("[급락"))
    return "bg-orange-900/30 border-orange-800 text-orange-300";
  return "bg-green-900/30 border-green-800 text-green-300";
};

export default function AlertBanner({ alerts }: Props) {
  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div key={i} className={`border rounded-xl px-4 py-3 text-sm ${getAlertStyle(alert)}`}>
          {alert}
        </div>
      ))}
    </div>
  );
}

"use client";

interface Props {
  alerts: string[];
}

const getAlertStyle = (alert: string) => {
  if (alert.includes("[위험") || alert.includes("[전체 경보]"))
    return {
      background: "#FFF0F0",
      border: "1px solid #FFCDD2",
      color: "#B71C1C",
      icon: "🔴",
    };
  if (alert.includes("[급락"))
    return {
      background: "#FFF8E1",
      border: "1px solid #FFE082",
      color: "#E65100",
      icon: "🟠",
    };
  return {
    background: "#F0FFF4",
    border: "1px solid #A5D6A7",
    color: "#1B5E20",
    icon: "🟢",
  };
};

export default function AlertBanner({ alerts }: Props) {
  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const style = getAlertStyle(alert);
        return (
          <div
            key={i}
            className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
            style={{
              background: style.background,
              border: style.border,
              color: style.color,
            }}
          >
            <span>{style.icon}</span>
            <span>{alert}</span>
          </div>
        );
      })}
    </div>
  );
}

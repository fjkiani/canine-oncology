import { AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "../ui/Badge";
import { doseIsHeld } from "../../lib/utils";
import type { DoseResult } from "../../types/api";

interface DosageCardProps {
  dose: DoseResult;
}

export function DosageCard({ dose }: DosageCardProps) {
  const held = doseIsHeld(dose);
  const holdReason =
    dose.notes ||
    (dose.renal_adjustment === "hold" ? "Held for renal adjustment" : null) ||
    (dose.hepatic_adjustment === "hold" ? "Held for hepatic adjustment" : null) ||
    "Drug held — see clinical notes";

  return (
    <div
      className={`rounded-xl border p-4 ${
        held ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
      } shadow-sm`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {held ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          <h3 className="text-sm font-semibold text-gray-900 capitalize">{dose.drug}</h3>
        </div>
        {held ? <Badge variant="danger">HOLD</Badge> : <Badge variant="success">Active</Badge>}
      </div>

      {held ? (
        <p className="text-sm text-red-700">{holdReason}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-400">Dose</p>
              <p className="text-lg font-bold text-gray-900">{dose.final_dose_mg} mg</p>
              <p className="text-xs text-gray-500">{dose.dose_per_kg.toFixed(2)} mg/kg</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Schedule</p>
              <p className="text-sm font-medium text-gray-800">{dose.schedule}</p>
              <p className="text-xs text-gray-500">{dose.route}</p>
            </div>
          </div>

          {(dose.renal_adjustment !== "none" || dose.hepatic_adjustment !== "none") && (
            <div className="pt-3 border-t border-gray-100 mb-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Adjustments</p>
              <ul className="space-y-1 text-xs text-yellow-700">
                {dose.renal_adjustment !== "none" && (
                  <li className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-500" />
                    Renal: {dose.renal_adjustment}
                  </li>
                )}
                {dose.hepatic_adjustment !== "none" && (
                  <li className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-500" />
                    Hepatic: {dose.hepatic_adjustment}
                  </li>
                )}
              </ul>
            </div>
          )}

          {dose.warnings.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1">Warnings</p>
              <ul className="space-y-1">
                {dose.warnings.map((adj, i) => (
                  <li key={i} className="text-xs text-yellow-700 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-500" />
                    {adj}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

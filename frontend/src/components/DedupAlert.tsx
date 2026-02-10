// ---------------------------------------------------------------------------
// DedupAlert – Warning box when a domain already exists in the database
// ---------------------------------------------------------------------------

import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface DedupAlertProps {
  domain: string;
  existingProspectId: number;
  existingStatus: string;
  firstContactedAt?: string;
}

const DedupAlert: React.FC<DedupAlertProps> = ({
  domain,
  existingProspectId,
  existingStatus,
  firstContactedAt,
}) => {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-800">
            Duplicate domain detected
          </h4>
          <p className="mt-1 text-sm text-red-700">
            The domain <span className="font-mono font-medium">{domain}</span> already
            exists in the database.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-red-700">
            <span>
              Status:{" "}
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                {existingStatus}
              </span>
            </span>

            {firstContactedAt && (
              <span>
                First contacted:{" "}
                <span className="font-medium">
                  {format(new Date(firstContactedAt), "dd MMM yyyy")}
                </span>
              </span>
            )}
          </div>

          <div className="mt-3">
            <Link
              to={`/prospects/${existingProspectId}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-red-700 underline decoration-red-300 underline-offset-2 hover:text-red-900 hover:decoration-red-500"
            >
              View existing prospect #{existingProspectId}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DedupAlert;

import Bottleneck from "bottleneck";
import * as fs from "fs";

type BatchAndUploadOptions<T> = {
  data: T[]; // The full array of items to be processed in batches
  batchSize?: number; // Optional: Size of each batch (default is 100)
  uploadFunction: (batch: T[]) => Promise<{ hubspotIds: string[] }>; // Must return success status and HubSpot IDs
  rateLimit?: { maxConcurrent: number; minTime: number }; // Optional: Rate-limiting configuration
  onError?: (error: Error, batch: T[]) => void; // Optional: Callback for handling errors when a batch fails
  onProgress?: (progressLog: string) => void; // Optional: Callback for reporting progress
  enableNativeLogging?: boolean; // Optional: Whether to log progress natively (default is true)
  logFileLocation?: string; // Optional: File location to save detailed error logs
};

/**
 * Formats the current date and time for log messages.
 * @returns {string} The formatted timestamp in the format YYYY-MM-DD HH:MM:SS.
 */
function getFormattedTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace("T", " ").split(".")[0]; // Format: YYYY-MM-DD HH:MM:SS
}

/**
 * Handles bulk operations by splitting data into batches, applying rate limiting,
 * logging errors, and ensuring the process continues without being interrupted by individual batch failures.
 *
 * @param {BatchAndUploadOptions<T>} options - The options for the batch processing.
 * @returns {Promise<void>} Resolves when all batches have been processed.
 */
export async function batchAndUpload<T>({
  data,
  batchSize = 100,
  uploadFunction,
  rateLimit = { maxConcurrent: 5, minTime: 200 },
  onError,
  onProgress,
  enableNativeLogging = true,
  logFileLocation, // Optional log file location for detailed error logs
}: BatchAndUploadOptions<T>): Promise<void> {
  const limiter = new Bottleneck({
    maxConcurrent: rateLimit.maxConcurrent, // Max concurrent operations
    minTime: rateLimit.minTime, // Min delay between operations
  });

  const batches: T[][] = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize)); // Split data into batches
  }

  const totalBatches = batches.length;
  let successfullyUploadedBatches = 0;
  let failedBatches = 0;
  const errors: { error: Error; batch: T[] }[] = [];

  for (const batch of batches) {
    try {
      await limiter.schedule(async () => {
        try {
          const response = await uploadFunction(batch);
          if (response && response.hubspotIds.length === batch.length) {
            successfullyUploadedBatches += 1;
          } else {
            failedBatches += 1;
            const errorMessage =
              "Some items in the batch failed to get a HubSpot ID.";
            errors.push({ error: new Error(errorMessage), batch });
            if (onError) {
              onError(new Error(errorMessage), batch);
            }
          }
        } catch (error) {
          failedBatches += 1;
          if (error instanceof Error) {
            errors.push({ error, batch });
            if (onError) {
              onError(error, batch);
            }
          } else {
            const unknownError = new Error("An unknown error occurred.");
            errors.push({ error: unknownError, batch });
            if (onError) {
              onError(unknownError, batch);
            }
          }
        }
      });
    } finally {
      const completedPercentage = Math.round(
        (successfullyUploadedBatches / totalBatches) * 100
      );
      const failedPercentage = Math.round((failedBatches / totalBatches) * 100);
      const remainingPercentage = 100 - completedPercentage - failedPercentage;

      const progressLog = `[${getFormattedTimestamp()}] Progress: ${completedPercentage}% successfully uploaded, ${failedPercentage}% failed, ${remainingPercentage}% remaining.`;

      if (enableNativeLogging) {
        console.log(progressLog);
      }

      if (onProgress) {
        onProgress(progressLog);
      }
    }
  }

  // If there are errors, log them to the specified file
  if (errors.length > 0 && logFileLocation) {
    const logLines = errors.map(({ error, batch }, index) => {
      const batchDetails = JSON.stringify(batch, null, 2);
      return `[${getFormattedTimestamp()}] Batch ${
        index + 1
      } failed with error: ${error.message}\nBatch Details: ${batchDetails}`;
    });

    try {
      fs.writeFileSync(logFileLocation, logLines.join("\n\n"), "utf-8");
      console.error(
        `[${getFormattedTimestamp()}] ${
          errors.length
        } batches failed. See detailed logs at: ${logFileLocation}`
      );
    } catch (fileError) {
      console.error(
        `[${getFormattedTimestamp()}] Failed to write error logs to file: ${
          (fileError as Error).message
        }`
      );
    }
  } else if (errors.length > 0) {
    console.error(
      `[${getFormattedTimestamp()}] ${
        errors.length
      } batches failed. Provide a logFileLocation parameter to save detailed logs.`
    );
  }
}

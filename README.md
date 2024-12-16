# **hubspot-bulkify**

A utility for handling **bulk data uploads** to HubSpot with the following features:

- Rate-limiting using Bottleneck
- Automatic batch splitting
- Progress tracking and logging
- Error handling with optional detailed error logs saved to a file

---

## **Installation**

Install `hubspot-bulkify` using npm:

```bash
npm install hubspot-bulkify
```

---

## **Usage**

Here's an example demonstrating how to use the `batchAndUpload` function to upload batches of data to HubSpot:

### **Code Example**

```typescript
import { batchAndUpload } from "hubspot-bulkify";
import Hubspot from "@hubspot/api-client";

// Initialize HubSpot API client
const hubspotClient = new Hubspot.Client({ accessToken: "YOUR_HUBSPOT_ACCESS_TOKEN" });

// Example data array: HubSpot deals to be uploaded
const deals = [
  { properties: { dealname: "Deal 1", amount: "1000", dealstage: "appointmentscheduled" } },
  { properties: { dealname: "Deal 2", amount: "2000", dealstage: "qualifiedtobuy" } },
  { properties: { dealname: "Deal 3", amount: "3000", dealstage: "presentationscheduled" } },
  { properties: { dealname: "Deal 4", amount: "4000", dealstage: "decisionmakerboughtin" } },
];

// Upload function using HubSpot's Batch API
async function uploadDealsBatch(batch: any[]): Promise<{ hubspotIds: string[] }> {
  try {
    const response = await hubspotClient.crm.deals.batchApi.create({
      inputs: batch,
    });

    // Extract and return HubSpot deal IDs
    const hubspotIds = response.results.map((deal: any) => deal.id);
    return { hubspotIds };
  } catch (error) {
    console.error("HubSpot API Error:", error.message);
    throw error;
  }
}

// Run the batch upload process
async function main() {
  await batchAndUpload({
    data: deals,
    batchSize: 2, // Upload 2 deals per batch
    uploadFunction: uploadDealsBatch, // Upload function using HubSpot SDK
    rateLimit: { maxConcurrent: 2, minTime: 1000 }, // Rate limit to avoid exceeding API limits
    logFileLocation: "./hubspot-upload-errors.txt", // Path to save detailed error logs
    enableNativeLogging: true, // Log progress in the console
    onProgress: (progressLog) => {
      console.log(progressLog); // Progress log callback
    },
    onError: (error, batch) => {
      console.error(`Error uploading batch: ${error.message}`);
    },
  });
}

main().catch((err) => console.error("Error running batch process:", err));

```

---

## **Parameters**

### `batchAndUpload<T>(options: BatchAndUploadOptions<T>)`

The function takes the following options:

| Parameter             | Type                                  | Required | Description                                                                                                                                   |
|-----------------------|---------------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `data`                | `T[]`                                | Yes      | The array of data items to be processed in batches.                                                                                          |
| `batchSize`           | `number`                             | No       | The size of each batch (default is `100`).                                                                                                   |
| `uploadFunction`      | `(batch: T[]) => Promise<{ hubspotIds: string[] }>` | Yes      | The function to process/upload each batch. Must return a list of `hubspotIds` corresponding to the batch items.                              |
| `rateLimit`           | `{ maxConcurrent: number; minTime: number }` | No       | Rate-limiting configuration. Example: `{ maxConcurrent: 2, minTime: 500 }` for 2 concurrent uploads with a 500ms delay between each.         |
| `onError`             | `(error: Error, batch: T[]) => void` | No       | A callback to handle errors for failed batches.                                                                                             |
| `onProgress`          | `(progressLog: string) => void`      | No       | A callback to receive progress logs.                                                                                                         |
| `enableNativeLogging` | `boolean`                            | No       | Enable logging progress natively to the console (default is `true`).                                                                         |
| `logFileLocation`     | `string`                             | No       | File path to save detailed error logs. If omitted, errors will only display in the console.                                                  |

---

## **Output**

1. **Progress Tracking**
   - Logs progress to the console (or via `onProgress`) showing the percentage of successful, failed, and remaining batches.

   Example output:
   ```
   [2024-06-05 12:34:56] Progress: 50% successfully uploaded, 0% failed, 50% remaining.
   [2024-06-05 12:35:00] Progress: 100% successfully uploaded, 0% failed, 0% remaining.
   ```

2. **Error Logging**
   - Errors for failed batches are logged into a file (if `logFileLocation` is provided) and displayed in the console.

   Example:
   ```
   [2024-06-05 12:35:10] 2 batches failed. See detailed logs at: ./error-log.txt
   ```

   Contents of `error-log.txt`:
   ```
   [2024-06-05 12:35:10] Batch 1 failed with error: Some items in the batch failed to get a HubSpot ID.
   Batch Details: [
     { "name": "Deal 2", "amount": 2000 }
   ]
   ```

---

## **Features**

- **Rate Limiting**: Avoid overwhelming HubSpot's API with `maxConcurrent` and `minTime` limits.
- **Batch Processing**: Data is split into manageable batches for upload.
- **Error Handling**: Handles batch-level errors without stopping the entire process.
- **Progress Tracking**: Real-time progress logs via console or callback.
- **Error Logs**: Optional file-based logging for detailed error analysis.

---

## **Repository**

[GitHub Repository](https://github.com/KilianTrunk/hubspot-bulkify)

---

## **Contributions**

Contributions are welcome! Please fork the repository, make your changes, and submit a pull request.

1. Fork the project.
2. Create your feature branch:
   ```bash
   git checkout -b feature/YourFeatureName
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add some feature"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/YourFeatureName
   ```
5. Open a pull request.
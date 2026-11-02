import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import logger from '@/lib/logger';

const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL;

let secretClient: SecretClient | null = null;

if (keyVaultUrl) {
  try {
    const credential = new DefaultAzureCredential();
    secretClient = new SecretClient(keyVaultUrl, credential);
    logger.info('Successfully connected to Azure Key Vault');
  } catch (error) {
    logger.error(error, 'Failed to connect to Azure Key Vault');
  }
} else {
  logger.warn(
    'AZURE_KEY_VAULT_URL is not set. Azure Key Vault integration is disabled.'
  );
}

/**
 * Retrieves a secret from Azure Key Vault.
 * @param secretName The name of the secret to retrieve.
 * @returns The secret value, or null if the secret is not found or Key Vault is not configured.
 */
export async function getSecret(secretName: string): Promise<string | null> {
  if (!secretClient) {
    return null;
  }

  try {
    const secret = await secretClient.getSecret(secretName);
    return secret.value ?? null;
  } catch (error) {
    logger.error(
      { secretName, error },
      'Failed to retrieve secret from Azure Key Vault'
    );
    return null;
  }
}

# Backup and Disaster Recovery

This document outlines the procedures for backing up and recovering the Netting Reconciliation application's data.

## Database Backups

The application uses a self-hosted Supabase instance running on an Azure VM. The primary data store is a PostgreSQL database.

### Backup Procedure

A backup script, `backup.sh`, is provided in this directory to create a compressed SQL dump of the database.

1.  **SSH into the Azure VM**:

    ```bash
    ssh <user>@<azure-vm-ip>
    ```

2.  **Run the backup script**:

    ```bash
    cd /path/to/project/docker
    ./backup.sh
    ```

    This will create a new backup file in the `/var/opt/backups` directory on the VM.

### Scheduling Backups

It is recommended to schedule the backup script to run at regular intervals using a cron job.

1.  **Open the crontab editor**:

    ```bash
    crontab -e
    ```

2.  **Add a new cron job**:
    To run the backup script every day at midnight, add the following line:
    ```
    0 0 * * * /path/to/project/docker/backup.sh
    ```

### Recovery Procedure

To restore the database from a backup:

1.  **Identify the backup file** you want to restore from in the `/var/opt/backups` directory.

2.  **Restore the backup**:
    ```bash
    gunzip < /path/to/backup.sql.gz | docker exec -i db psql -U postgres
    ```

## Infrastructure as Code

The application's infrastructure is defined using Terraform in the `terraform/` directory. In the event of a complete disaster, the entire infrastructure can be reprovisioned using Terraform.

Refer to the `terraform/README.md` for instructions on how to provision the infrastructure.

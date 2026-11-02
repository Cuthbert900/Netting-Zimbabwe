%{ if domain_name != ":8000" ~}
{
	email ${letsencrypt_email}
}

${domain_name} {
	encode gzip
	handle_path /studio/* {
		basic_auth {
			{$DASHBOARD_USERNAME} {$DASHBOARD_PASSWORD_HASH}
		}
		reverse_proxy studio:3000
	}
	handle {
		reverse_proxy kong:8000
	}
}
%{ else ~}
# No domain_name set — plain HTTP on :8000, reachable only from
# allowed_admin_cidrs (see the NSG). Fine for a first boot smoke test;
# set domain_name + letsencrypt_email before this carries real traffic.
:8000 {
	encode gzip
	handle_path /studio/* {
		basic_auth {
			{$DASHBOARD_USERNAME} {$DASHBOARD_PASSWORD_HASH}
		}
		reverse_proxy studio:3000
	}
	handle {
		reverse_proxy kong:8000
	}
}
%{ endif ~}

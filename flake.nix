{
	description = "Iceshrimp development flake";

	inputs = {
		nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
		# Flake Parts framework(https://flake.parts)
		flake-parts.url = "github:hercules-ci/flake-parts";
		# Devenv for better devShells(https://devenv.sh)
		devenv.url = "github:cachix/devenv";
	};
	outputs = inputs@{ flake-parts, ... }:
		flake-parts.lib.mkFlake { inherit inputs; } {
			imports = [
				inputs.devenv.flakeModule
			];

			# Define the systems that this works on. Only tested with x86_64-linux, add more if you test and it works.
			systems = [
				"x86_64-linux"
				"aarch64-linux"
			];
			# Expose these attributes for every system defined above.
			perSystem = { config, pkgs, ... }: {
				# Devenv shells
				devenv = {
					shells = {
						# The default shell, used by nix-direnv
						default = {
							name = "iceshrimp-dev-shell";
							# Add additional packages to our environment
							packages = [
								pkgs.python3
								pkgs.corepack_20
							];
							# No need to warn on a new version, we'll update as needed.
							devenv.warnOnNewVersion = false;
							# Enable typescript support
							languages.typescript.enable = true;
							# Enable javascript for NPM and Yarn
							languages.javascript.enable = true;
							languages.javascript.package = pkgs.nodejs_20;
							processes = {
								dev-server.exec = "yarn run dev";
							};
							scripts = {
								build.exec = "yarn run build";
								clean.exec = "yarn run clean";
								clear-state.exec = "rm -rf .devenv/state/redis .devenv/state/postgres";
								format.exec = "yarn run format";
								install-deps.exec = "yarn install";
								migrate.exec = "yarn run migrate";
								prepare-config.exec = "cp .config/devenv.yml .config/default.yml";
							};
							services = {
								postgres = {
									enable = true;
									package = pkgs.postgresql_12;
									initialDatabases = [{
										name = "iceshrimp";
									}];
									initialScript = ''
										CREATE USER iceshrimp WITH PASSWORD 'iceshrimp';
										ALTER USER iceshrimp WITH SUPERUSER;
										GRANT ALL ON DATABASE iceshrimp TO iceshrimp;
									'';
									listen_addresses = "127.0.0.1";
									port = 5432;
								};
								redis = {
									enable = true;
									bind = "127.0.0.1";
									port = 6379;
								};
							};
						};
					};
				};
			};
		};
}

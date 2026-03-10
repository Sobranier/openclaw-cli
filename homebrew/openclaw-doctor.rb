# openclaw-doctor is an alias for openclaw-cli.
# The main formula is openclaw-cli — install that instead:
#
#   brew install Sobranier/openclaw/openclaw-cli
#
class OpenclawDoctor < Formula
  desc "Alias for openclaw-cli — health-watch daemon for OpenClaw gateway"
  homepage "https://github.com/Sobranier/openclaw-doctor"
  url "https://github.com/Sobranier/openclaw-doctor/archive/refs/tags/v0.3.0.tar.gz"
  sha256 "REPLACE_WITH_SHA256_AFTER_RELEASE"
  license "MIT"

  depends_on "node"
  # Recommend the primary formula
  deprecated_unless "openclaw-cli is now the primary package; this formula is kept for backward compatibility."

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/openclaw-cli"] => "openclaw-doctor"
    bin.install_symlink Dir["#{libexec}/bin/openclaw-cli"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/openclaw-doctor --version")
  end
end

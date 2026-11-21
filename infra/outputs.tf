# Read by the CI deploy job; none of these is secret.
output "frontend_project_id" { value = vercel_project.frontend.id }
output "backend_project_id" { value = vercel_project.backend.id }
output "frontend_url" { value = local.frontend_url }
output "api_url" { value = local.api_url }

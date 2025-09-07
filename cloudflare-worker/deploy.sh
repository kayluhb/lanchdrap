#!/bin/bash

echo "Starting deployment..."
echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la

echo "Running wrangler deploy..."
wrangler deploy

echo "Deployment completed with exit code: $?"

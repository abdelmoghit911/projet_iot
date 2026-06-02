-- SIV Database Schema
CREATE DATABASE IF NOT EXISTS siv_db;
USE siv_db;

-- Bus table
CREATE TABLE IF NOT EXISTS bus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    immatriculation VARCHAR(20) NOT NULL UNIQUE,
    numero VARCHAR(10) NOT NULL,
    etat ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lignes (routes) table
CREATE TABLE IF NOT EXISTS lignes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stations table
CREATE TABLE IF NOT EXISTS stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    ligne_id INT,
    ordre INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ligne_id) REFERENCES lignes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- GPS Positions table
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    speed DECIMAL(5, 1) DEFAULT 0,
    date_position TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES bus(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Telemetry table
CREATE TABLE IF NOT EXISTS telemetrie (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    speed DECIMAL(5, 1) DEFAULT 0,
    fuel DECIMAL(5, 1) DEFAULT 0,
    engine_temp DECIMAL(5, 1) DEFAULT 0,
    odometer DECIMAL(10, 1) DEFAULT 0,
    doors ENUM('open', 'closed') DEFAULT 'closed',
    date_reception TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES bus(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alerts table
CREATE TABLE IF NOT EXISTS alertes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES bus(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Sample buses
INSERT INTO bus (immatriculation, numero, etat) VALUES
('12345-A-1', 'BUS001', 'active'),
('23456-B-2', 'BUS002', 'active'),
('34567-C-3', 'BUS003', 'active'),
('45678-D-4', 'BUS004', 'maintenance'),
('56789-E-5', 'BUS005', 'active');

-- Sample routes (lignes)
INSERT INTO lignes (nom, description) VALUES
('Ligne 1', 'Gare ONA - Maarif - Hay Hassani'),
('Ligne 2', 'Place Mohammed V - Anfa - Sidi Bernoussi'),
('Ligne 3', 'Aïn Diab - Corniche - Bd Zerktouni');

-- Sample stations for Ligne 1 (Casablanca area)
INSERT INTO stations (nom, latitude, longitude, ligne_id, ordre) VALUES
('Gare ONA', 33.5888, -7.5638, 1, 1),
('Place Mohammed V', 33.5912, -7.6183, 1, 2),
('Maarif', 33.5735, -7.6325, 1, 3),
('Hay Hassani', 33.5600, -7.6500, 1, 4);

-- Sample stations for Ligne 2
INSERT INTO stations (nom, latitude, longitude, ligne_id, ordre) VALUES
('Place Mohammed V', 33.5912, -7.6183, 2, 1),
('Bd Zerktouni', 33.5850, -7.6250, 2, 2),
('Anfa', 33.5900, -7.6400, 2, 3),
('Sidi Bernoussi', 33.6100, -7.5000, 2, 4);

-- Sample stations for Ligne 3
INSERT INTO stations (nom, latitude, longitude, ligne_id, ordre) VALUES
('Aïn Diab', 33.5800, -7.6700, 3, 1),
('Corniche', 33.5850, -7.6600, 3, 2),
('Bd Zerktouni', 33.5850, -7.6250, 3, 3);

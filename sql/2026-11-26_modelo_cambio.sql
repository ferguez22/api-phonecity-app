CREATE TABLE modelo_lote (
  id           INT(11)    NOT NULL AUTO_INCREMENT,
  tienda_id    INT(11)    NOT NULL,
  fecha        DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id   INT(11)    NOT NULL,
  deshecho_en  DATETIME   NULL DEFAULT NULL,
  deshecho_por INT(11)    NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_modelo_lote_tienda (tienda_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modelo_cambio (
  id              INT(11)      NOT NULL AUTO_INCREMENT,
  lote_id         INT(11)      NOT NULL,
  linea_id        INT(11)      NOT NULL,
  modelo_anterior VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  modelo_nuevo    VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  restaurado      TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_modelo_cambio_lote (lote_id),
  CONSTRAINT fk_modelo_cambio_lote FOREIGN KEY (lote_id) REFERENCES modelo_lote (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
